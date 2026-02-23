import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import CommunityForm from './CommunityForm'
import { useToast } from '../../context/ToastContext'

const STATUS_BADGE = {
    active: { cls: 'badge-success', label: 'Active' },
    inactive: { cls: 'badge-muted', label: 'Inactive' },
    terminated: { cls: 'badge-danger', label: 'Terminated' },
}

export default function Communities() {
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [search, setSearch] = useState('')
    const qc = useQueryClient()
    const { showToast } = useToast()

    const { data: communities = [], isLoading } = useQuery({
        queryKey: ['communities'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('communities')
                .select('*, sports(id, sport_name, coach_sport_assignments(coach_id))')
                .order('name')
            if (error) throw error
            return data
        },
    })

    const filtered = communities.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.contact_person.toLowerCase().includes(search.toLowerCase())
    )

    const handleEdit = (c) => { setEditing(c); setShowForm(true) }
    const handleClose = () => { setEditing(null); setShowForm(false) }
    const handleSaved = () => {
        qc.invalidateQueries({ queryKey: ['communities'] })
        handleClose()
        showToast(editing ? 'Community updated successfully!' : 'Community added successfully!')
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Communities</h1>
                    <p className="page-subtitle">{communities.length} registered communities</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    + Add Community
                </button>
            </div>

            <div className="page-body">
                {/* Search */}
                <div style={{ marginBottom: '20px' }}>
                    <div className="search-bar" style={{ maxWidth: '360px' }}>
                        <span className="search-icon">🔍</span>
                        <input
                            className="input"
                            placeholder="Search communities…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="page-loading"><div className="spinner" /> Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏘</div>
                        <div className="empty-state-title">No Communities Yet</div>
                        <p className="empty-state-text">Add your first community to get started.</p>
                        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Community</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                        {filtered.map(c => {
                            const b = STATUS_BADGE[c.status] ?? STATUS_BADGE.inactive
                            const sports = c.sports ?? []
                            const coachCount = new Set(
                                sports.flatMap(s => (s.coach_sport_assignments ?? []).map(a => a.coach_id))
                            ).size
                            return (
                                <Link
                                    key={c.id}
                                    to={`/communities/${c.id}`}
                                    style={{ textDecoration: 'none', display: 'block' }}
                                >
                                    <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = ''}
                                    >
                                        <div className="card-header" style={{ marginBottom: '12px' }}>
                                            <span style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', fontSize: '1.15rem', letterSpacing: '0.04em' }}>
                                                {c.name}
                                            </span>
                                            <span className={`badge ${b.cls}`}>{b.label}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                            <span>👤 {c.contact_person}</span>
                                            <span>📞 {c.contact_phone}</span>
                                            {c.monthly_fee && <span>💰 ₹{Number(c.monthly_fee).toLocaleString('en-IN')}/month</span>}
                                            <span>📆 Since {new Date(c.contract_start_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}</span>
                                        </div>

                                        {/* Sports + Coach Count */}
                                        <div>
                                            {sports.length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                                    {sports.map(s => (
                                                        <span key={s.id} className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                                            {s.sport_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '6px' }}>No sports added yet</div>
                                            )}
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                🧑‍🏫 <strong style={{ color: coachCount > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{coachCount}</strong> coach{coachCount !== 1 ? 'es' : ''}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>

            {showForm && (
                <CommunityForm
                    community={editing}
                    onClose={handleClose}
                    onSaved={handleSaved}
                />
            )}
        </>
    )
}
