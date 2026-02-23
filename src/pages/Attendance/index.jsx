import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCommunities } from '../../hooks/useCommunities'
import { getMonthName } from '../../utils/dateUtils'
import AttendanceGrid from './AttendanceGrid'

export default function Attendance() {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const [selectedCommunity, setSelectedCommunity] = useState('')
    const [selectedSport, setSelectedSport] = useState('')
    const [selectedCoach, setSelectedCoach] = useState('')
    const [month, setMonth] = useState(currentMonth)
    const [year, setYear] = useState(currentYear)

    const { data: communities = [], isLoading: commLoading } = useCommunities()

    // Sports for selected community
    const { data: sports = [] } = useQuery({
        queryKey: ['sports', selectedCommunity],
        queryFn: async () => {
            if (!selectedCommunity) return []
            const { data, error } = await supabase
                .from('sports')
                .select('*')
                .eq('community_id', selectedCommunity)
                .order('sport_name')
            if (error) throw error
            return data
        },
        enabled: !!selectedCommunity,
    })

    // Coaches for selected sport (via assignments) — include joining_date
    const { data: coaches = [] } = useQuery({
        queryKey: ['coaches-for-sport', selectedSport],
        queryFn: async () => {
            if (!selectedSport) return []
            const { data, error } = await supabase
                .from('coach_sport_assignments')
                .select('coach_id, coaches(id, name, joining_date, relieving_date)')
                .eq('sport_id', selectedSport)
            if (error) throw error
            return data.map(d => d.coaches)
        },
        enabled: !!selectedSport,
    })

    const selectedSportObj = sports.find(s => s.id === selectedSport)
    const selectedCoachObj = coaches.find(c => c.id === selectedCoach)

    // Reset downstream selects when parent changes
    useEffect(() => { setSelectedSport(''); setSelectedCoach('') }, [selectedCommunity])
    useEffect(() => { setSelectedCoach('') }, [selectedSport])

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const years = [2026, 2027, 2028]
    const isReady = selectedCommunity && selectedSport && selectedCoach

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Attendance Review</h1>
                    <p className="page-subtitle">Mark exceptions (A/SUB) for the month. Default = Present.</p>
                </div>
            </div>

            <div className="page-body">
                {/* Filter bar */}
                <div className="card mb-6">
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ flex: '0 0 110px' }}>
                            <label className="input-label">Month</label>
                            <select className="select" value={month} onChange={e => setMonth(Number(e.target.value))}>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '0 0 90px' }}>
                            <label className="input-label">Year</label>
                            <select className="select" value={year} onChange={e => setYear(Number(e.target.value))}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '1 1 200px' }}>
                            <label className="input-label">Community</label>
                            <select className="select" value={selectedCommunity} onChange={e => setSelectedCommunity(e.target.value)}>
                                <option value="">— Select Community —</option>
                                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '1 1 160px' }}>
                            <label className="input-label">Sport</label>
                            <select className="select" value={selectedSport} onChange={e => setSelectedSport(e.target.value)} disabled={!selectedCommunity}>
                                <option value="">— Select Sport —</option>
                                {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: '1 1 160px' }}>
                            <label className="input-label">Coach</label>
                            <select className="select" value={selectedCoach} onChange={e => setSelectedCoach(e.target.value)} disabled={!selectedSport}>
                                <option value="">— Select Coach —</option>
                                {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Grid or empty state */}
                {isReady ? (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">{selectedCoachObj?.name} — {MONTHS[month - 1]} {year} — {selectedSportObj?.sport_name}</h3>
                        </div>
                        {selectedCoachObj?.joining_date && (() => {
                            const jd = new Date(selectedCoachObj.joining_date)
                            const joinMonth = jd.getMonth() + 1
                            const joinYear = jd.getFullYear()
                            const isMidMonth = joinYear === year && joinMonth === month
                            if (!isMidMonth) return null
                            return (
                                <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', fontSize: '0.85rem', color: 'var(--warning)' }}>
                                    ⚠️ {selectedCoachObj?.name} joined on <strong>{jd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> — days before joining are disabled.
                                </div>
                            )
                        })()}
                        {selectedCoachObj?.relieving_date && (() => {
                            const rd = new Date(selectedCoachObj.relieving_date)
                            const relMonth = rd.getMonth() + 1
                            const relYear = rd.getFullYear()
                            const isMidMonth = relYear === year && relMonth === month
                            if (!isMidMonth) return null
                            return (
                                <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 6, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', fontSize: '0.85rem', color: 'var(--danger)' }}>
                                    🔴 {selectedCoachObj?.name} last worked on <strong>{rd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> — days after this are locked.
                                </div>
                            )
                        })()}
                        <AttendanceGrid
                            key={`${selectedCoach}-${selectedSport}-${selectedCommunity}-${month}-${year}`}
                            coachId={selectedCoach}
                            sportId={selectedSport}
                            communityId={selectedCommunity}
                            sport={selectedSportObj}
                            month={month}
                            year={year}
                            coachName={selectedCoachObj?.name}
                            joiningDate={selectedCoachObj?.joining_date || null}
                            relievingDate={selectedCoachObj?.relieving_date || null}
                        />
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <div className="empty-state-title">Select Coach &amp; Period</div>
                        <p className="empty-state-text">Choose community, sport, and coach above to review attendance.</p>
                    </div>
                )}
            </div>
        </>
    )
}
