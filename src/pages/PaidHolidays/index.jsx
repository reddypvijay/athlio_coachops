import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getDaysInMonth, getDay } from 'date-fns'
import { useToast } from '../../context/ToastContext'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function PaidHolidays() {
    const now = new Date()
    const [communityId, setCommunityId] = useState('')
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [holidayNames, setHolidayNames] = useState({}) // day -> name
    const qc = useQueryClient()
    const { showToast } = useToast()

    const { data: communities = [] } = useQuery({
        queryKey: ['communities'],
        queryFn: async () => {
            const { data } = await supabase.from('communities').select('id, name').eq('status', 'active').order('name')
            return data ?? []
        },
    })

    const { data: holidays = [], isLoading: loadingHols } = useQuery({
        queryKey: ['paid-holidays', communityId, month, year],
        enabled: !!communityId,
        queryFn: async () => {
            const lastDay = getDaysInMonth(new Date(year, month - 1))
            const { data } = await supabase
                .from('paid_holidays')
                .select('*')
                .eq('community_id', communityId)
                .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
                .lte('date', `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
            return data ?? []
        },
    })

    // Map day number → holiday (parse date string directly to avoid timezone issues)
    const phMap = {}
    holidays.forEach(h => {
        const day = parseInt(h.date.split('-')[2], 10)  // 'YYYY-MM-DD' → day number
        phMap[day] = h
    })

    // Toggle a PH day
    const togglePH = useMutation({
        mutationFn: async ({ day, isCurrentlyPH }) => {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            if (isCurrentlyPH) {
                const { error } = await supabase.from('paid_holidays').delete().eq('community_id', communityId).eq('date', dateStr)
                if (error) throw error
            } else {
                const { error } = await supabase.from('paid_holidays').insert({
                    community_id: communityId,
                    date: dateStr,
                    holiday_name: holidayNames[day] || null,
                })
                if (error) throw error
            }
        },
        onMutate: ({ day, isCurrentlyPH }) => {
            const key = ['paid-holidays', communityId, month, year]
            const prev = qc.getQueryData(key) ?? []
            if (isCurrentlyPH) {
                // Optimistically remove
                qc.setQueryData(key, prev.filter(h => parseInt(h.date.split('-')[2], 10) !== day))
            } else {
                // Optimistically add a placeholder
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                qc.setQueryData(key, [...prev, { id: `tmp-${day}`, community_id: communityId, date: dateStr, holiday_name: null }])
            }
            return { prev }
        },
        onError: (_, __, ctx) => {
            // Roll back on error
            if (ctx?.prev) qc.setQueryData(['paid-holidays', communityId, month, year], ctx.prev)
        },
        onSuccess: (_, { isCurrentlyPH }) => {
            qc.invalidateQueries({ queryKey: ['paid-holidays', communityId, month, year] })
            if (!isCurrentlyPH) showToast('Paid holiday marked!')
        },
    })

    // Calendar layout
    const daysInMonth = getDaysInMonth(new Date(year, month - 1))
    // getDay: 0=Sun, we want 0=Mon
    const firstDayRaw = getDay(new Date(year, month - 1, 1)) // 0=Sun
    const firstDayMon = firstDayRaw === 0 ? 6 : firstDayRaw - 1  // shift so Mon=0

    const years = [2026, 2027, 2028]

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Paid Holidays</h1>
                    <p className="page-subtitle">Configure community-specific paid holidays per month</p>
                </div>
            </div>

            <div className="page-body">
                {/* Controls */}
                <div className="card mb-6">
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ flex: '1 1 220px' }}>
                            <label className="input-label">Community</label>
                            <select className="select" value={communityId} onChange={e => setCommunityId(e.target.value)}>
                                <option value="">— Select Community —</option>
                                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '0 0 130px' }}>
                            <label className="input-label">Month</label>
                            <select className="select" value={month} onChange={e => setMonth(Number(e.target.value))}>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '0 0 100px' }}>
                            <label className="input-label">Year</label>
                            <select className="select" value={year} onChange={e => setYear(Number(e.target.value))}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {!communityId ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📅</div>
                        <div className="empty-state-title">Select a Community</div>
                        <p className="empty-state-text">Choose a community above to manage its paid holidays.</p>
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                {MONTHS[month - 1]} {year} — {communities.find(c => c.id === communityId)?.name}
                            </h3>
                            <span className="badge badge-primary">{holidays.length} PH set</span>
                        </div>

                        <div className="alert alert-info mb-4" style={{ fontSize: '0.82rem' }}>
                            Click any date to toggle it as a Paid Holiday. PH applies to ALL coaches at this community automatically.
                        </div>

                        {/* Calendar */}
                        <div className="calendar-grid" style={{ marginBottom: '16px' }}>
                            {DAY_LABELS.map(d => (
                                <div key={d} className="cal-header">{d}</div>
                            ))}
                            {/* Empty cells before first day */}
                            {Array.from({ length: firstDayMon }).map((_, i) => (
                                <div key={`empty-${i}`} className="cal-day cal-day-empty" />
                            ))}
                            {/* Days */}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                const ph = phMap[day]
                                return (
                                    <div
                                        key={day}
                                        className={`cal-day${ph ? ' cal-day-ph' : ''}`}
                                        onClick={() => !togglePH.isPending && togglePH.mutate({ day, isCurrentlyPH: !!ph })}
                                    >
                                        <span className="cal-day-num">{day}</span>
                                        {ph && <span className="cal-day-label">PH</span>}
                                        {ph?.holiday_name && (
                                            <div style={{ fontSize: '0.55rem', color: 'var(--primary)', marginTop: '2px', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {ph.holiday_name}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Holiday list with name editor */}
                        {holidays.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '10px' }}>Holiday Names (Optional)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {holidays.map(h => {
                                        const day = new Date(h.date).getDate()
                                        return (
                                            <div key={h.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)', minWidth: '60px' }}>
                                                    {MONTHS[month - 1]} {day}
                                                </span>
                                                <input
                                                    className="input"
                                                    placeholder="Holiday name (e.g., Holi)"
                                                    defaultValue={h.holiday_name ?? ''}
                                                    style={{ flex: 1 }}
                                                    onChange={e => setHolidayNames(n => ({ ...n, [day]: e.target.value }))}
                                                    onBlur={async e => {
                                                        const name = e.target.value.trim() || null
                                                        await supabase.from('paid_holidays').update({ holiday_name: name }).eq('id', h.id)
                                                    }}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}
