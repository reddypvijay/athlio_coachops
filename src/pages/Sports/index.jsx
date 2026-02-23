import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'

export default function Sports() {
    const qc = useQueryClient()
    const { showToast } = useToast()
    const [adding, setAdding] = useState(false)
    const [newName, setNewName] = useState('')
    const [editId, setEditId] = useState(null)
    const [editName, setEditName] = useState('')
    const [error, setError] = useState('')

    const { data: sports = [], isLoading } = useQuery({
        queryKey: ['sport_masters'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sport_masters')
                .select('id, name, created_at')
                .order('name')
            if (error) throw error
            return data
        },
    })

    const addMutation = useMutation({
        mutationFn: async (name) => {
            const { error } = await supabase.from('sport_masters').insert({ name: name.trim() })
            if (error) throw error
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sport_masters'] })
            setNewName('')
            setAdding(false)
            setError('')
            showToast('Sport added to catalog!')
        },
        onError: (err) => setError(err.message),
    })

    const editMutation = useMutation({
        mutationFn: async ({ id, name }) => {
            const { error } = await supabase.from('sport_masters').update({ name: name.trim() }).eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sport_masters'] })
            setEditId(null)
            setError('')
            showToast('Sport updated!')
        },
        onError: (err) => setError(err.message),
    })

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('sport_masters').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sport_masters'] })
            showToast('Sport deleted.')
        },
        onError: (err) => showToast('Cannot delete: ' + err.message, 'error'),
    })

    function handleAdd(e) {
        e.preventDefault()
        if (!newName.trim()) { setError('Sport name is required'); return }
        addMutation.mutate(newName)
    }

    function startEdit(sport) {
        setEditId(sport.id)
        setEditName(sport.name)
        setError('')
    }

    function handleEdit(e) {
        e.preventDefault()
        if (!editName.trim()) { setError('Sport name is required'); return }
        editMutation.mutate({ id: editId, name: editName })
    }

    if (isLoading) return <div className="page-loading"><div className="spinner" /> Loading…</div>

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sports</h1>
                    <p className="page-subtitle">Global sports catalog. These sports can be assigned to any community.</p>
                </div>
                {!adding && (
                    <button className="btn btn-primary" onClick={() => { setAdding(true); setError('') }}>
                        + Add Sport
                    </button>
                )}
            </div>

            <div className="page-body">
                {/* Add form */}
                {adding && (
                    <div className="card mb-6">
                        <div className="card-header">
                            <h3 className="card-title">New Sport</h3>
                        </div>
                        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: 1, minWidth: 220 }}>
                                <label className="input-label">Sport Name *</label>
                                <input
                                    className="input"
                                    value={newName}
                                    onChange={e => { setNewName(e.target.value); setError('') }}
                                    placeholder="e.g. Badminton, Tennis, Swimming"
                                    autoFocus
                                />
                                {error && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>{error}</div>}
                            </div>
                            <button className="btn btn-primary" disabled={addMutation.isPending}>
                                {addMutation.isPending ? 'Adding…' : 'Add Sport'}
                            </button>
                            <button className="btn btn-ghost" type="button" onClick={() => { setAdding(false); setNewName(''); setError('') }}>
                                Cancel
                            </button>
                        </form>
                    </div>
                )}

                {/* List */}
                {sports.length === 0 && !adding ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏅</div>
                        <div className="empty-state-title">No Sports Yet</div>
                        <p className="empty-state-text">Click <strong>+ Add Sport</strong> to start building the catalog.</p>
                    </div>
                ) : sports.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Sports Catalog ({sports.length})</h3>
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Sport Name</th>
                                        <th style={{ width: 200 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sports.map(sport => (
                                        <tr key={sport.id}>
                                            <td>
                                                {editId === sport.id ? (
                                                    <form onSubmit={handleEdit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <input
                                                            className="input"
                                                            value={editName}
                                                            onChange={e => setEditName(e.target.value)}
                                                            style={{ margin: 0, maxWidth: 240 }}
                                                            autoFocus
                                                        />
                                                        {error && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
                                                        <button className="btn btn-primary btn-sm" disabled={editMutation.isPending}>
                                                            {editMutation.isPending ? 'Saving…' : 'Save'}
                                                        </button>
                                                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditId(null)}>
                                                            Cancel
                                                        </button>
                                                    </form>
                                                ) : (
                                                    <span style={{ fontWeight: 500 }}>{sport.name}</span>
                                                )}
                                            </td>
                                            <td>
                                                {editId !== sport.id && (
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(sport)}>✏ Edit</button>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ color: 'var(--danger)' }}
                                                            disabled={deleteMutation.isPending}
                                                            onClick={() => {
                                                                if (confirm(`Delete "${sport.name}"? This cannot be undone.`))
                                                                    deleteMutation.mutate(sport.id)
                                                            }}
                                                        >
                                                            🗑 Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: 24, padding: '12px 16px', borderRadius: 8, background: 'rgba(232,255,71,0.06)', border: '1px solid rgba(232,255,71,0.15)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    💡 Sports added here appear as a dropdown when you add a sport to a community — no more typing names manually.
                </div>
            </div>
        </>
    )
}
