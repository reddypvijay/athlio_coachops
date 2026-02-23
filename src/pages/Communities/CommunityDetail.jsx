import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import CommunityForm from './CommunityForm'
import SportForm from './SportForm'
import { useToast } from '../../context/ToastContext'

export default function CommunityDetail() {
    const { id } = useParams()
    const qc = useQueryClient()
    const { showToast } = useToast()
    const [editingCommunity, setEditingCommunity] = useState(false)
    const [addingSport, setAddingSport] = useState(false)
    const [editingSport, setEditingSport] = useState(null)
    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState(null) // { coachId, coachName, currentStatus, relievingDate }

    const { data: community, isLoading } = useQuery({
        queryKey: ['community', id],
        queryFn: async () => {
            const { data, error } = await supabase.from('communities').select('*').eq('id', id).single()
            if (error) throw error
            return data
        },
    })

    const { data: sports = [] } = useQuery({
        queryKey: ['sports', id],
        queryFn: async () => {
            const { data, error } = await supabase.from('sports').select('*').eq('community_id', id).order('sport_name')
            if (error) throw error
            return data
        },
    })

    const { data: assignments = [] } = useQuery({
        queryKey: ['assignments-by-community', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('coach_sport_assignments')
                .select('*, coaches(id, name, phone, status), sports!inner(sport_name, community_id)')
                .eq('sports.community_id', id)
            if (error) throw error
            return data
        },
    })

    // Split into active and former (inactive/on_leave)
    const activeAssignments = assignments.filter(a => a.coaches?.status === 'active')
    const formerAssignments = assignments.filter(a => a.coaches?.status !== 'active')

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['community', id] })
        qc.invalidateQueries({ queryKey: ['sports', id] })
        qc.invalidateQueries({ queryKey: ['communities'] })
    }

    // Toggle coach status mutation
    const toggleStatus = useMutation({
        mutationFn: async ({ coachId, newStatus, relievingDate }) => {
            const update = { status: newStatus }
            if (newStatus === 'inactive' && relievingDate) {
                update.relieving_date = relievingDate
            } else if (newStatus === 'active') {
                update.relieving_date = null  // clear if reactivated
            }
            const { error } = await supabase.from('coaches').update(update).eq('id', coachId)
            if (error) throw error
        },
        onSuccess: (_, { coachName, newStatus }) => {
            qc.invalidateQueries({ queryKey: ['assignments-by-community', id] })
            qc.invalidateQueries({ queryKey: ['coaches'] })
            showToast(`${coachName} marked as ${newStatus}`)
            setConfirmModal(null)
        },
        onError: (err) => {
            showToast(`Failed: ${err.message}`, 'error')
            setConfirmModal(null)
        },
    })

    function handleStatusClick(a) {
        setConfirmModal({
            coachId: a.coach_id,
            coachName: a.coaches?.name,
            currentStatus: a.coaches?.status,
            relievingDate: new Date().toISOString().split('T')[0], // default to today
        })
    }

    function confirmToggle() {
        if (!confirmModal) return
        const { coachId, coachName, currentStatus, relievingDate } = confirmModal
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
        toggleStatus.mutate({ coachId, coachName, newStatus, relievingDate })
    }

    if (isLoading) return <div className="page-loading"><div className="spinner" /> Loading…</div>
    if (!community) return <div className="page-body"><div className="alert alert-danger">Community not found.</div></div>

    return (
        <>
            <div className="page-header">
                <div>
                    <Link to="/communities" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
                        ← Communities
                    </Link>
                    <h1 className="page-title" style={{ marginTop: '6px' }}>{community.name}</h1>
                    <p className="page-subtitle">
                        {community.address} · {community.contact_person} · {community.contact_phone}
                    </p>
                </div>
                <button className="btn btn-ghost" onClick={() => setEditingCommunity(true)}>Edit</button>
            </div>

            <div className="page-body">
                {/* Active Coaches */}
                <div className="card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">Assigned Coaches ({activeAssignments.length})</h3>
                        <Link to="/coaches" className="btn btn-ghost btn-sm">Manage Coaches →</Link>
                    </div>
                    {activeAssignments.length === 0 ? (
                        <p className="text-muted text-sm">No active coaches assigned yet.</p>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Coach</th>
                                        <th>Sport</th>
                                        <th>Monthly Salary</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeAssignments.map(a => (
                                        <tr key={a.id}>
                                            <td>
                                                <Link to={`/coaches/${a.coach_id}`} style={{ color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}>
                                                    {a.coaches?.name}
                                                </Link>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.coaches?.phone}</div>
                                            </td>
                                            <td>{a.sports?.sport_name}</td>
                                            <td className="font-mono">₹{Number(a.monthly_salary).toLocaleString('en-IN')}</td>
                                            <td>
                                                <button
                                                    className="badge badge-success"
                                                    onClick={() => handleStatusClick(a)}
                                                    title="Click to change status"
                                                    style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
                                                >
                                                    active
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Former Coaches */}
                {formerAssignments.length > 0 && (
                    <div className="card mb-6">
                        <div className="card-header">
                            <h3 className="card-title" style={{ color: 'var(--text-muted)' }}>
                                Former Coaches ({formerAssignments.length})
                            </h3>
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Coach</th>
                                        <th>Sport</th>
                                        <th>Monthly Salary</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formerAssignments.map(a => (
                                        <tr key={a.id} style={{ opacity: 0.7 }}>
                                            <td>
                                                <Link to={`/coaches/${a.coach_id}`} style={{ color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}>
                                                    {a.coaches?.name}
                                                </Link>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.coaches?.phone}</div>
                                            </td>
                                            <td>{a.sports?.sport_name}</td>
                                            <td className="font-mono">₹{Number(a.monthly_salary).toLocaleString('en-IN')}</td>
                                            <td>
                                                <button
                                                    className={`badge ${a.coaches?.status === 'on_leave' ? 'badge-warning' : 'badge-muted'}`}
                                                    onClick={() => handleStatusClick(a)}
                                                    title="Click to reactivate"
                                                    style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
                                                >
                                                    {a.coaches?.status}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Sports */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Sports ({sports.length})</h3>
                        <button className="btn btn-primary btn-sm" onClick={() => setAddingSport(true)}>+ Add Sport</button>
                    </div>

                    {sports.length === 0 ? (
                        <div className="empty-state" style={{ padding: '30px' }}>
                            <div className="empty-state-icon">🏃</div>
                            <div className="empty-state-title">No Sports Yet</div>
                            <p className="empty-state-text">Add the first sport for this community.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {sports.map(s => {
                                const timings = s.shift_timings ?? []
                                const opDays = s.operating_days ?? []
                                return (
                                    <div key={s.id} style={{
                                        background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                                        padding: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px' }}>{s.sport_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                <span>🗓 {opDays.join(', ')}</span>
                                                <span>· Off: {(s.weekly_off_days ?? []).join(', ')}</span>
                                                {timings.length > 0 && <span>· ⏰ {timings.map(t => `${t.start}–${t.end}`).join(', ')}</span>}
                                                {s.location_within_community && <span>· 📍 {s.location_within_community}</span>}
                                            </div>
                                        </div>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingSport(s)}>Edit</button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Status confirmation modal */}
            {confirmModal && (
                <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
                    <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Change Coach Status</h3>
                            <button className="btn btn-icon btn-ghost" onClick={() => setConfirmModal(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '0.95rem', marginBottom: '8px' }}>
                                Are you sure you want to mark <strong>{confirmModal.coachName}</strong> as{' '}
                                <strong style={{ color: confirmModal.currentStatus === 'active' ? 'var(--danger)' : 'var(--success)' }}>
                                    {confirmModal.currentStatus === 'active' ? 'inactive' : 'active'}
                                </strong>?
                            </p>
                            {confirmModal.currentStatus === 'active' && (
                                <>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                        They will be moved to the Former Coaches section. Assignments and attendance history will be preserved.
                                    </p>
                                    <div className="input-group">
                                        <label className="input-label">Last Working Day</label>
                                        <input
                                            type="date"
                                            className="input"
                                            value={confirmModal.relievingDate}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={e => setConfirmModal(prev => ({ ...prev, relievingDate: e.target.value }))}
                                        />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            Attendance days after this date will be locked automatically.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
                            <button
                                className={`btn ${confirmModal.currentStatus === 'active' ? 'btn-danger' : 'btn-primary'}`}
                                onClick={confirmToggle}
                                disabled={toggleStatus.isPending}
                            >
                                {toggleStatus.isPending ? 'Saving…' : `Mark ${confirmModal.currentStatus === 'active' ? 'Inactive' : 'Active'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingCommunity && (
                <CommunityForm community={community} onClose={() => setEditingCommunity(false)} onSaved={() => { invalidate(); setEditingCommunity(false); showToast('Community updated!') }} />
            )}
            {(addingSport || editingSport) && (
                <SportForm
                    communityId={id}
                    sport={editingSport}
                    onClose={() => { setAddingSport(false); setEditingSport(null) }}
                    onSaved={() => { qc.invalidateQueries({ queryKey: ['sports', id] }); setAddingSport(false); setEditingSport(null); showToast(editingSport ? 'Sport updated!' : 'Sport added to community!') }}
                />
            )}
        </>
    )
}
