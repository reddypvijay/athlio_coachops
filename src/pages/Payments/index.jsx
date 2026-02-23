import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCommunities } from '../../hooks/useCommunities'
import { getMonthName, formatCurrency } from '../../utils/dateUtils'

export default function Payments() {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const [month, setMonth] = useState(currentMonth)
    const [year, setYear] = useState(currentYear)
    const [selectedCommunity, setSelectedCommunity] = useState('')
    const [hasLoaded, setHasLoaded] = useState(false)

    const queryClient = useQueryClient()
    const { data: communities = [] } = useCommunities()

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // ── Fetch attendance records (same as Payroll) ─────────────────────────
    const { data: rows = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ['payments-attendance', month, year, selectedCommunity],
        queryFn: async () => {
            // 1. Attendance records
            let q = supabase
                .from('monthly_attendance')
                .select(`
                    *,
                    coaches ( id, name, bank_ifsc, upi_id, phone, joining_date ),
                    sports ( id, sport_name, operating_days, weekly_off_days, community_id, communities(id, name) )
                `)
                .eq('month', month)
                .eq('year', year)

            if (selectedCommunity) q = q.eq('community_id', selectedCommunity)

            const { data: records, error: recErr } = await q
            if (recErr) throw new Error(recErr.message)
            if (!records || records.length === 0) return []

            // 2. Assignments (for salary lookup)
            const coachIds = [...new Set(records.map(r => r.coach_id))]
            const sportIds = [...new Set(records.map(r => r.sport_id))]
            const { data: assignments, error: aErr } = await supabase
                .from('coach_sport_assignments')
                .select('coach_id, sport_id, monthly_salary')
                .in('coach_id', coachIds)
                .in('sport_id', sportIds)
            if (aErr) throw new Error(aErr.message)

            const salaryLookup = {}
            for (const a of (assignments || [])) {
                salaryLookup[`${a.coach_id}:${a.sport_id}`] = Number(a.monthly_salary)
            }

            // 3. Existing payment records
            const { data: payments, error: pErr } = await supabase
                .from('salary_payments')
                .select('*')
                .eq('month', month)
                .eq('year', year)
            if (pErr) throw new Error(pErr.message)

            const paymentLookup = {}
            for (const p of (payments || [])) {
                paymentLookup[`${p.coach_id}:${p.sport_id}`] = p
            }

            // 4. Build rows
            return records.map(rec => {
                const monthlySalary = salaryLookup[`${rec.coach_id}:${rec.sport_id}`] ?? 0
                const totalCalendarDays = new Date(rec.year, rec.month, 0).getDate()
                const joiningDateStr = rec.coaches?.joining_date
                const joiningDay = (() => {
                    if (!joiningDateStr) return 1
                    const jd = new Date(joiningDateStr)
                    if (jd.getFullYear() === rec.year && (jd.getMonth() + 1) === rec.month) return jd.getDate()
                    return 1
                })()
                const eligibleDays = totalCalendarDays - joiningDay + 1
                const absences = rec.days_absent || 0
                const subs = rec.days_substitute || 0
                const halfDays = Object.values(rec.attendance_data || {}).filter(v => v === 'HD').length
                const paidDays = Math.max(0, eligibleDays - absences - subs - halfDays * 0.5)
                const calcSalary = totalCalendarDays > 0
                    ? Math.round((paidDays / totalCalendarDays) * monthlySalary * 100) / 100
                    : 0

                const paymentRecord = paymentLookup[`${rec.coach_id}:${rec.sport_id}`]

                return {
                    coachId: rec.coach_id,
                    sportId: rec.sport_id,
                    communityId: rec.sports?.community_id,
                    coachName: rec.coaches?.name,
                    sport: rec.sports?.sport_name,
                    community: rec.sports?.communities?.name,
                    paidDays,
                    calcSalary,
                    isPaid: paymentRecord?.is_paid ?? false,
                    paidAt: paymentRecord?.paid_at ?? null,
                    paymentId: paymentRecord?.id ?? null,
                }
            })
        },
        enabled: false,
        retry: false,
        staleTime: 0,
    })

    // ── Toggle paid ────────────────────────────────────────────────────────
    const togglePaid = useMutation({
        mutationFn: async ({ row, markPaid }) => {
            const payload = {
                coach_id: row.coachId,
                sport_id: row.sportId,
                community_id: row.communityId,
                month,
                year,
                paid_days: row.paidDays,
                amount: row.calcSalary,
                is_paid: markPaid,
                paid_at: markPaid ? new Date().toISOString() : null,
            }
            const { error } = await supabase
                .from('salary_payments')
                .upsert(payload, { onConflict: 'coach_id,sport_id,month,year' })
            if (error) throw new Error(error.message)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments-attendance', month, year, selectedCommunity] })
            refetch()
        },
    })

    function handleLoad() {
        setHasLoaded(true)
        refetch()
    }

    function handleFilterChange(setter, val) {
        setter(val)
        setHasLoaded(false)
    }

    const paidCount = useMemo(() => rows.filter(r => r.isPaid).length, [rows])
    const unpaidCount = rows.length - paidCount
    const totalAmount = useMemo(() => rows.reduce((s, r) => s + r.calcSalary, 0), [rows])
    const paidAmount = useMemo(() => rows.filter(r => r.isPaid).reduce((s, r) => s + r.calcSalary, 0), [rows])
    const busy = isLoading || isFetching

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Payments</h1>
                    <p className="page-subtitle">Track salary payments — mark coaches as paid for the month.</p>
                </div>
            </div>

            <div className="page-body">
                {/* Filter bar */}
                <div className="card mb-6">
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ flex: '0 0 110px' }}>
                            <label className="input-label">Month</label>
                            <select className="select" value={month} onChange={e => handleFilterChange(setMonth, Number(e.target.value))}>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '0 0 90px' }}>
                            <label className="input-label">Year</label>
                            <select className="select" value={year} onChange={e => handleFilterChange(setYear, Number(e.target.value))}>
                                {[2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '1 1 200px' }}>
                            <label className="input-label">Community</label>
                            <select className="select" value={selectedCommunity} onChange={e => handleFilterChange(setSelectedCommunity, e.target.value)}>
                                <option value="">— All Communities —</option>
                                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div style={{ paddingBottom: '2px' }}>
                            <button className="btn btn-primary" disabled={busy} onClick={handleLoad}>
                                {busy ? 'Loading…' : 'Load'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Empty state */}
                {hasLoaded && !busy && rows.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-icon">💳</div>
                        <div className="empty-state-title">No Records Found</div>
                        <p className="empty-state-text">No attendance saved for {MONTHS[month - 1]} {year}.<br />Run payroll first via the Payroll page.</p>
                    </div>
                )}

                {/* Table */}
                {rows.length > 0 && (
                    <>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Coach</th>
                                        <th>Sport</th>
                                        <th>Community</th>
                                        <th style={{ textAlign: 'right' }}>Paid Days</th>
                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                        <th style={{ textAlign: 'center' }}>Status</th>
                                        <th style={{ textAlign: 'center' }}>Paid On</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, idx) => (
                                        <tr key={idx} style={{ opacity: row.isPaid ? 0.75 : 1 }}>
                                            <td style={{ fontWeight: 600 }}>{row.coachName}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>{row.sport}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>{row.community}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{row.paidDays}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
                                                {formatCurrency(row.calcSalary)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    onClick={() => togglePaid.mutate({ row, markPaid: !row.isPaid })}
                                                    disabled={togglePaid.isPending}
                                                    style={{
                                                        padding: '5px 14px',
                                                        borderRadius: 20,
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                        fontSize: '0.78rem',
                                                        letterSpacing: '0.04em',
                                                        transition: 'all 0.15s',
                                                        background: row.isPaid
                                                            ? 'rgba(22,163,74,0.12)'
                                                            : 'rgba(220,38,38,0.1)',
                                                        color: row.isPaid
                                                            ? 'var(--success)'
                                                            : 'var(--danger)',
                                                    }}
                                                >
                                                    {row.isPaid ? '✓ Paid' : 'Unpaid'}
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {row.paidAt
                                                    ? new Date(row.paidAt).toLocaleString('en-IN', {
                                                        day: '2-digit', month: 'short', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit',
                                                    })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary footer */}
                        <div style={{
                            position: 'sticky',
                            bottom: 0,
                            marginTop: 24,
                            background: 'var(--surface)',
                            border: '1px solid var(--border-2)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '18px 28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 16,
                            boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Total Coaches</div>
                                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.4rem', fontWeight: 700 }}>{rows.length}</div>
                                </div>
                                <div style={{ width: 1, height: 36, background: 'var(--border-2)' }} />
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Paid</div>
                                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>{paidCount}</div>
                                </div>
                                <div style={{ width: 1, height: 36, background: 'var(--border-2)' }} />
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Unpaid</div>
                                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.4rem', fontWeight: 700, color: 'var(--danger)' }}>{unpaidCount}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Paid Amount</div>
                                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.3rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(paidAmount)}</div>
                                </div>
                                <div style={{ width: 1, height: 36, background: 'var(--border-2)' }} />
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Total Payout</div>
                                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(totalAmount)}</div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    )
}
