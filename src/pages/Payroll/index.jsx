import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getMonthName, formatCurrency } from '../../utils/dateUtils'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import * as XLSX from 'xlsx'

export default function Payroll() {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const [month, setMonth] = useState(currentMonth)
    const [year, setYear] = useState(currentYear)
    const [hasCalculated, setHasCalculated] = useState(false)

    const { data: payrollData = [], isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['payroll', month, year],
        queryFn: async () => {
            console.log('[Payroll] Fetching attendance for month=%d year=%d', month, year)

            // Step 1: Fetch attendance records for the month
            const { data: records, error: recErr } = await supabase
                .from('monthly_attendance')
                .select(`
                    *,
                    coaches ( id, name, bank_ifsc, upi_id, phone, joining_date ),
                    sports ( id, sport_name, operating_days, weekly_off_days, communities(name) )
                `)
                .eq('month', month)
                .eq('year', year)

            if (recErr) {
                console.error('[Payroll] attendance query error:', recErr)
                throw new Error(recErr.message)
            }

            console.log('[Payroll] records returned:', records?.length, records)

            if (!records || records.length === 0) return []

            // Step 2: Batch-fetch assignments
            const coachIds = [...new Set(records.map(r => r.coach_id))]
            const sportIds = [...new Set(records.map(r => r.sport_id))]

            const { data: assignments, error: aErr } = await supabase
                .from('coach_sport_assignments')
                .select('coach_id, sport_id, monthly_salary')
                .in('coach_id', coachIds)
                .in('sport_id', sportIds)

            if (aErr) {
                console.error('[Payroll] assignments query error:', aErr)
                throw new Error(aErr.message)
            }

            console.log('[Payroll] assignments returned:', assignments?.length, assignments)

            // Lookup: `${coachId}:${sportId}` → monthly_salary
            const salaryLookup = {}
            for (const a of (assignments || [])) {
                salaryLookup[`${a.coach_id}:${a.sport_id}`] = Number(a.monthly_salary)
            }

            // Step 3: Group by coach and calculate
            const coachMap = {}
            for (const rec of records) {
                const coachId = rec.coach_id
                if (!coachMap[coachId]) {
                    coachMap[coachId] = { coach: rec.coaches, assignments: [], totalSalary: 0 }
                }

                const monthlySalary = salaryLookup[`${coachId}:${rec.sport_id}`] ?? 0

                // Formula: salary / calendar_days × (eligible_days − A − SUB)
                // eligible_days respects mid-month joining (denominator stays full month)
                const totalCalendarDays = new Date(rec.year, rec.month, 0).getDate()
                const joiningDateStr = rec.coaches?.joining_date
                const joiningDay = (() => {
                    if (!joiningDateStr) return 1
                    const jd = new Date(joiningDateStr)
                    if (jd.getFullYear() === rec.year && (jd.getMonth() + 1) === rec.month)
                        return jd.getDate()
                    return 1
                })()
                const eligibleDays = totalCalendarDays - joiningDay + 1
                const absences = rec.days_absent || 0
                const subs = rec.days_substitute || 0
                // Count HD from attendance_data JSON (each HD = 0.5 day deduction)
                const attendanceData = rec.attendance_data || {}
                const halfDays = Object.values(attendanceData).filter(v => v === 'HD').length
                const paidDays = Math.max(0, eligibleDays - absences - subs - halfDays * 0.5)
                const calcSalary = totalCalendarDays > 0
                    ? Math.round((paidDays / totalCalendarDays) * monthlySalary * 100) / 100
                    : 0

                coachMap[coachId].assignments.push({
                    sport: rec.sports?.sport_name,
                    community: rec.sports?.communities?.name,
                    totalCalendarDays,
                    joiningDay,
                    eligibleDays,
                    absences,
                    halfDays,
                    subs,
                    paidDays,
                    daysAbsent: absences,
                    daysSub: subs,
                    paidHolidays: rec.paid_holidays,
                    monthlySalary,
                    calcSalary,
                })
                coachMap[coachId].totalSalary = Math.round(
                    (coachMap[coachId].totalSalary + calcSalary) * 100
                ) / 100
            }

            return Object.values(coachMap)
        },
        enabled: false,   // only fetch when user clicks Calculate
        retry: false,
        staleTime: 0,
    })

    function handleCalculate() {
        setHasCalculated(true)
        refetch()
    }

    function handleMonthChange(val) {
        setMonth(val)
        setHasCalculated(false)
    }

    function handleYearChange(val) {
        setYear(val)
        setHasCalculated(false)
    }

    function exportExcel() {
        const rows = []
        for (const entry of payrollData) {
            for (const a of entry.assignments) {
                rows.push({
                    'Coach Name': entry.coach.name,
                    'Phone': entry.coach.phone,
                    'Sport': a.sport,
                    'Community': a.community,
                    'Calendar Days': a.totalCalendarDays,
                    'Paid Days': a.paidDays,
                    'Days Absent': a.daysAbsent,
                    'Days Substitute': a.daysSub,
                    'Paid Holidays': a.paidHolidays,
                    'Assignment Salary': a.monthlySalary,
                    'Calculated Salary': a.calcSalary,
                    'IFSC': entry.coach.bank_ifsc || '',
                    'UPI': entry.coach.upi_id || '',
                })
            }
        }
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, `Payroll ${getMonthName(month)} ${year}`)
        XLSX.writeFile(wb, `CoachOps_Payroll_${getMonthName(month)}_${year}.xlsx`)
    }

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const busy = isLoading || isFetching

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Payroll</h1>
                    <p className="page-subtitle">Calculate and export monthly payroll for all coaches.</p>
                </div>
                {payrollData.length > 0 && (
                    <Button variant="primary" onClick={exportExcel}>Export Excel</Button>
                )}
            </div>

            <div className="page-body">
                {/* Filter bar */}
                <div className="card mb-6">
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ flex: '0 0 110px' }}>
                            <label className="input-label">Month</label>
                            <select className="select" value={month} onChange={e => handleMonthChange(Number(e.target.value))}>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '0 0 90px' }}>
                            <label className="input-label">Year</label>
                            <select className="select" value={year} onChange={e => handleYearChange(Number(e.target.value))}>
                                {[2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div style={{ paddingBottom: '2px' }}>
                            <Button variant="primary" loading={busy} onClick={handleCalculate}>
                                Calculate Payroll
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Error display */}
                {error && (
                    <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: 'var(--danger)', fontSize: '0.875rem' }}>
                        <strong>Error:</strong> {error.message}
                    </div>
                )}

                {/* Empty state — only after user has clicked Calculate */}
                {hasCalculated && !busy && !error && payrollData.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-icon">💰</div>
                        <div className="empty-state-title">No Records Found</div>
                        <p className="empty-state-text">No attendance saved for {MONTHS[month - 1]} {year}.<br />Go to Attendance, select a coach and save attendance first.</p>
                    </div>
                )}

                {/* Results */}
                {payrollData.map(entry => (
                    <Card
                        key={entry.coach.id}
                        className="mb-4"
                        title={entry.coach.name}
                        actions={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{entry.coach.phone}</span>
                                <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
                                    {formatCurrency(entry.totalSalary)}
                                </span>
                            </div>
                        }
                    >
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Sport</th>
                                        <th>Community</th>
                                        <th title="Calendar days eligible (from joining date if mid-month)">Eligible Days</th>
                                        <th>Paid Days</th>
                                        <th>A</th>
                                        <th>SUB</th>
                                        <th>PH</th>
                                        <th>Assignment Salary</th>
                                        <th>Calculated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entry.assignments.map((a, idx) => (
                                        <tr key={idx}>
                                            <td>{a.sport}</td>
                                            <td>{a.community}</td>
                                            <td style={{ fontFamily: 'DM Mono, monospace' }} title={`Month has ${a.totalCalendarDays} calendar days`}>
                                                {a.eligibleDays ?? a.totalCalendarDays}
                                                {a.joiningDay > 1 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>from {a.joiningDay}</span>}
                                            </td>
                                            <td style={{ fontFamily: 'DM Mono, monospace' }}>{a.paidDays}</td>
                                            <td>{a.daysAbsent > 0 ? <Badge variant="danger">{a.daysAbsent}</Badge> : '—'}</td>
                                            <td>{a.daysSub > 0 ? <Badge variant="warning">{a.daysSub}</Badge> : '—'}</td>
                                            <td>{a.paidHolidays > 0 ? <Badge variant="primary">{a.paidHolidays}</Badge> : '—'}</td>
                                            <td style={{ fontFamily: 'DM Mono, monospace' }}>{formatCurrency(a.monthlySalary)}</td>
                                            <td style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--success)' }}>
                                                {formatCurrency(a.calcSalary)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                                        <td colSpan={8} style={{ textAlign: 'right', paddingRight: 16 }}>Total</td>
                                        <td style={{ fontFamily: 'DM Mono, monospace', color: 'var(--primary)' }}>
                                            {formatCurrency(entry.totalSalary)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            IFSC: {entry.coach.bank_ifsc || '—'} | UPI: {entry.coach.upi_id || '—'}
                        </div>
                    </Card>
                ))}
            </div>
        </>
    )
}
