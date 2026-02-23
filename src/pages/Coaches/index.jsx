import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import CoachForm from './CoachForm'
import { useToast } from '../../context/ToastContext'

const STATUS_BADGE = {
    active: { cls: 'badge-success', label: 'Active' },
    inactive: { cls: 'badge-muted', label: 'Inactive' },
    on_leave: { cls: 'badge-warning', label: 'On Leave' },
}

export default function Coaches() {
    const [showForm, setShowForm] = useState(false)
    const [search, setSearch] = useState('')
    const qc = useQueryClient()
    const { showToast } = useToast()

    const { data: coaches = [], isLoading } = useQuery({
        queryKey: ['coaches'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('coaches')
                .select('*, coach_sport_assignments(id)')
                .order('name')
            if (error) throw error
            return data
        },
    })

    const filtered = coaches.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        (c.email ?? '').toLowerCase().includes(search.toLowerCase())
    )

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Coaches</h1>
                    <p className="page-subtitle">{coaches.filter(c => c.status === 'active').length} active coaches</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Coach</button>
            </div>

            <div className="page-body">
                <div style={{ marginBottom: '20px' }}>
                    <div className="search-bar" style={{ maxWidth: '360px' }}>
                        <span className="search-icon">🔍</span>
                        <input className="input" placeholder="Search by name, phone, email…" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {isLoading ? (
                    <div className="page-loading"><div className="spinner" /> Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👤</div>
                        <div className="empty-state-title">No Coaches Yet</div>
                        <p className="empty-state-text">Add your first coach to begin.</p>
                        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Coach</button>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Coach</th>
                                    <th>Phone</th>
                                    <th>Joined</th>
                                    <th>Assignments</th>
                                    <th>Documents</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => {
                                    const b = STATUS_BADGE[c.status] ?? STATUS_BADGE.inactive
                                    const docsOk = c.document_aadhaar_url && c.document_pan_url
                                    const assignCount = c.coach_sport_assignments?.length ?? 0
                                    return (
                                        <tr key={c.id}>
                                            <td>
                                                <Link to={`/coaches/${c.id}`} style={{ color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}>
                                                    {c.name}
                                                </Link>
                                                {c.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>}
                                            </td>
                                            <td className="font-mono" style={{ fontSize: '0.85rem' }}>{c.phone}</td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {new Date(c.joining_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td>
                                                <span className="badge badge-info">{assignCount} assignment{assignCount !== 1 ? 's' : ''}</span>
                                            </td>
                                            <td>
                                                {docsOk ? (
                                                    <span className="badge badge-success">✓ Uploaded</span>
                                                ) : (
                                                    <span className="badge badge-warning">⚠ Missing</span>
                                                )}
                                            </td>
                                            <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                                            <td>
                                                <Link to={`/coaches/${c.id}`} className="btn btn-ghost btn-sm">View →</Link>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForm && (
                <CoachForm
                    onClose={() => setShowForm(false)}
                    onSaved={() => {
                        qc.invalidateQueries({ queryKey: ['coaches'] })
                        setShowForm(false)
                        showToast('Coach added successfully!')
                    }}
                />
            )}
        </>
    )
}
