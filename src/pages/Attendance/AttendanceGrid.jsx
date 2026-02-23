import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getWorkingDaysInMonth, formatDate } from '../../utils/dateUtils'
import { format } from 'date-fns'
import SubstituteModal from './SubstituteModal'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

const CODE_COLORS = {
    P: 'success',
    HD: 'half',        // amber — new
    A: 'danger',
    SUB: 'warning',
    PH: 'primary',
    WO: 'neutral',
}

export default function AttendanceGrid({ coachId, sportId, communityId, sport, month, year, coachName, joiningDate, relievingDate }) {
    const [attendance, setAttendance] = useState({}) // { '5': 'A', '20': 'SUB', '12': 'HD' }
    const [savedAttendance, setSavedAttendance] = useState({}) // last persisted state
    const [paidHolidays, setPaidHolidays] = useState(new Set()) // set of day numbers
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [subModal, setSubModal] = useState({ open: false, date: null, dayNum: null })

    // Detect multi-shift sport — HD only available when ≥2 shifts
    const isMultiShift = (sport?.shift_timings ?? []).length >= 2

    const { count: totalWorkingDays, dates: workingDates } = getWorkingDaysInMonth(
        year, month, sport?.operating_days || []
    )

    // Determine first eligible day based on joining date
    const joiningDay = (() => {
        if (!joiningDate) return 1
        const jd = new Date(joiningDate)
        if (jd.getFullYear() === year && (jd.getMonth() + 1) === month) return jd.getDate()
        return 1
    })()

    // Determine last eligible day based on relieving date (null = no restriction)
    const relievingDay = (() => {
        if (!relievingDate) return null
        const rd = new Date(relievingDate)
        // Relieved before this month entirely
        if (rd.getFullYear() < year || (rd.getFullYear() === year && rd.getMonth() + 1 < month)) return 0
        // Relieved within this month
        if (rd.getFullYear() === year && rd.getMonth() + 1 === month) return rd.getDate()
        return null // relieved after this month — no restriction
    })()

    // All calendar dates in the month (not just operating days)
    const allDates = Array.from(
        { length: new Date(year, month, 0).getDate() },
        (_, i) => new Date(year, month - 1, i + 1)
    )

    useEffect(() => {
        if (!coachId || !sportId || !communityId) return
        loadData()
    }, [coachId, sportId, communityId, month, year])

    async function loadData() {
        setLoading(true)
        try {
            const { data: rec } = await supabase
                .from('monthly_attendance')
                .select('*')
                .eq('coach_id', coachId)
                .eq('sport_id', sportId)
                .eq('community_id', communityId)
                .eq('month', month)
                .eq('year', year)
                .maybeSingle()

            const data = rec?.attendance_data || {}
            setAttendance(data)
            setSavedAttendance(data)

            const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
            const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
            const { data: phData } = await supabase
                .from('paid_holidays')
                .select('date')
                .eq('community_id', communityId)
                .gte('date', monthStart)
                .lte('date', monthEnd)

            const opSet = new Set(sport?.operating_days || [])
            const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            const phDays = new Set(
                (phData || [])
                    .filter(ph => opSet.has(DAY_NAMES[new Date(ph.date).getDay()]))
                    .map(ph => new Date(ph.date).getDate())
            )
            setPaidHolidays(phDays)
        } finally {
            setLoading(false)
        }
    }

    function getDayCode(dayNum) {
        if (paidHolidays.has(dayNum)) return 'PH'
        return attendance[String(dayNum)] || 'P'
    }

    function isBeforeJoining(dayNum) {
        return dayNum < joiningDay
    }

    function isAfterRelieving(dayNum) {
        return relievingDay !== null && dayNum > relievingDay
    }

    function isEditable(date) {
        const dayNum = date.getDate()
        if (isBeforeJoining(dayNum)) return false
        if (isAfterRelieving(dayNum)) return false
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return date <= today
    }

    function cycleCode(dayNum, date) {
        const current = getDayCode(dayNum)
        if (current === 'PH') return
        if (!isEditable(date)) return

        if (current === 'P') {
            // Multi-shift: P → HD; single-shift: P → A
            if (isMultiShift) {
                setAttendance(prev => ({ ...prev, [String(dayNum)]: 'HD' }))
            } else {
                setAttendance(prev => ({ ...prev, [String(dayNum)]: 'A' }))
            }
        } else if (current === 'HD') {
            // HD → A (only reached for multi-shift)
            setAttendance(prev => ({ ...prev, [String(dayNum)]: 'A' }))
        } else if (current === 'A') {
            // Open substitute modal
            setSubModal({ open: true, date: format(date, 'yyyy-MM-dd'), dayNum })
        } else if (current === 'SUB') {
            // Clear back to P
            setAttendance(prev => {
                const next = { ...prev }
                delete next[String(dayNum)]
                return next
            })
        }
    }

    async function saveAttendance() {
        setSaving(true)
        try {
            const absences = Object.values(attendance).filter(v => v === 'A').length
            const subs = Object.values(attendance).filter(v => v === 'SUB').length
            const halfDays = Object.values(attendance).filter(v => v === 'HD').length
            const totalCalendarDays = new Date(year, month, 0).getDate()
            const eligibleDays = totalCalendarDays - joiningDay + 1
            // Each HD deducts 0.5 day
            const totalPaidDays = Math.max(0, eligibleDays - absences - subs - halfDays * 0.5)

            const paidDaysRounded = Math.round(totalPaidDays * 10) / 10
            const payload = {
                coach_id: coachId,
                sport_id: sportId,
                community_id: communityId,
                month,
                year,
                attendance_data: attendance,
                total_working_days: totalWorkingDays,
                days_present: paidDaysRounded,
                days_absent: absences,
                days_substitute: subs,
                paid_holidays: paidHolidays.size,
                total_paid_days: paidDaysRounded,
            }

            const { error } = await supabase
                .from('monthly_attendance')
                .upsert(payload, { onConflict: 'coach_id,sport_id,month,year' })

            if (error) throw error
            setSavedAttendance({ ...attendance })
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (err) {
            alert('Save failed: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    function onSubstituteSaved(dayNum) {
        setAttendance(prev => ({ ...prev, [String(dayNum)]: 'SUB' }))
    }

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading attendance…</div>

    const totalCalendarDays = new Date(year, month, 0).getDate()
    const lastDay = relievingDay !== null ? Math.min(relievingDay, totalCalendarDays) : totalCalendarDays
    const eligibleDays = Math.max(0, lastDay - joiningDay + 1)
    // Only count attendance codes within the eligible range
    const eligibleAttendance = Object.entries(attendance)
        .filter(([d]) => { const n = parseInt(d, 10); return n >= joiningDay && (relievingDay === null || n <= relievingDay) })
        .map(([, v]) => v)
    const absences = eligibleAttendance.filter(v => v === 'A').length
    const subs = eligibleAttendance.filter(v => v === 'SUB').length
    const halfDays = eligibleAttendance.filter(v => v === 'HD').length
    const phCount = [...paidHolidays].filter(d => d >= joiningDay && (relievingDay === null || d <= relievingDay)).length
    const totalPaidDays = Math.max(0, eligibleDays - absences - subs - halfDays * 0.5)

    const cycleHint = isMultiShift
        ? 'Click a day: P → Half Day → Absent → Substitute → P | PH = read-only'
        : 'Click a day: P → Absent → Substitute → P | PH = read-only'

    return (
        <div>
            {/* Summary bar */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                {joiningDay > 1 && (
                    <div className="stat-chip">Joined Day <strong>{joiningDay}</strong></div>
                )}
                {relievingDay !== null && (
                    <div className="stat-chip" style={{ color: 'var(--danger)' }}>Last Day <strong>{relievingDay}</strong></div>
                )}
                <div className="stat-chip">Eligible Days <strong>{eligibleDays}</strong></div>
                <div className="stat-chip">PH <strong>{phCount}</strong></div>
                <div className="stat-chip">Absent <strong style={{ color: 'var(--danger)' }}>{absences}</strong></div>
                {isMultiShift && halfDays > 0 && (
                    <div className="stat-chip">Half Days <strong style={{ color: 'var(--warning-amber)' }}>{halfDays}</strong></div>
                )}
                <div className="stat-chip">SUB <strong style={{ color: 'var(--warning)' }}>{subs}</strong></div>
                <div className="stat-chip">Paid Days <strong style={{ color: 'var(--success)' }}>{totalPaidDays}</strong></div>
            </div>

            {/* Multi-shift notice */}
            {isMultiShift && (
                <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 6, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)', fontSize: '0.82rem', color: 'var(--warning-amber)' }}>
                    🔀 <strong>2-shift sport</strong> — HD (Half Day) available. Each HD deducts 0.5 day from salary.
                </div>
            )}

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginBottom: 24 }}>
                {allDates.map(date => {
                    const dayNum = date.getDate()
                    const beforeJoining = isBeforeJoining(dayNum)
                    const afterRelieving = isAfterRelieving(dayNum)
                    const locked = beforeJoining || afterRelieving
                    const code = locked ? 'NA' : getDayCode(dayNum)
                    const editable = !locked && isEditable(date) && code !== 'PH'
                    return (
                        <div
                            key={dayNum}
                            onClick={() => editable && cycleCode(dayNum, date)}
                            title={
                                beforeJoining ? `Before joining (day ${joiningDay})`
                                    : afterRelieving ? `After last working day (day ${relievingDay})`
                                        : editable ? cycleHint : 'Not editable'
                            }
                            style={{
                                padding: '10px 8px',
                                borderRadius: 8,
                                border: `1px solid ${locked ? 'transparent' : 'var(--border)'}`,
                                textAlign: 'center',
                                cursor: editable ? 'pointer' : 'default',
                                opacity: locked ? 0.25 : editable ? 1 : 0.6,
                                background: locked ? 'transparent'
                                    : code === 'P' ? 'var(--surface)'
                                        : code === 'HD' ? 'rgba(234,88,12,0.10)'
                                            : code === 'A' ? 'rgba(220,38,38,0.10)'
                                                : code === 'SUB' ? 'rgba(217,119,6,0.10)'
                                                    : code === 'PH' ? 'rgba(37,99,235,0.08)'
                                                        : 'var(--surface)',
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {format(date, 'EEE')}
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>
                                {dayNum}
                            </div>
                            {locked ? (
                                <div style={{ fontSize: '0.65rem', marginTop: 4, color: 'var(--text-muted)' }}>—</div>
                            ) : (
                                <Badge variant={CODE_COLORS[code] || 'neutral'} style={{ fontSize: '0.65rem', marginTop: 4 }}>
                                    {code}
                                </Badge>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Success toast */}
            {saveSuccess && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 18px', borderRadius: 8, marginBottom: 12,
                    background: 'rgba(22,163,74,0.10)', border: '1px solid var(--success)',
                    color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem',
                    animation: 'slideInFade 0.3s ease',
                }}>
                    <span style={{ fontSize: '1.2rem' }}>✓</span>
                    Attendance saved successfully!
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="primary" loading={saving} onClick={saveAttendance}>
                    Save Attendance
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => {
                        if (confirm('Reset all changes back to the last saved state?'))
                            setAttendance(savedAttendance)
                    }}
                >
                    ↺ Reset
                </Button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {cycleHint}
                </span>
            </div>

            <SubstituteModal
                isOpen={subModal.open}
                onClose={() => setSubModal({ open: false, date: null, dayNum: null })}
                date={subModal.date}
                coachId={coachId}
                sportId={sportId}
                communityId={communityId}
                onSaved={() => onSubstituteSaved(subModal.dayNum)}
            />
        </div>
    )
}
