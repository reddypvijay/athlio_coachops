import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../utils/dateUtils'

export default function Substitutes() {
    const [markingPaid, setMarkingPaid] = useState(null)

    const { data: logs = [], isLoading, error, refetch } = useQuery({
        queryKey: ['substitute_logs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('substitute_logs')
                .select(`
                    *,
                    sports ( sport_name ),
                    communities ( name ),
                    coaches ( name )
                `)
                .order('date', { ascending: false })
            if (error) throw error
            return data
        },
    })

    async function markAsPaid(id) {
        setMarkingPaid(id)
        try {
            const { error } = await supabase
                .from('substitute_logs')
                .update({ is_paid: true, payment_date: new Date().toISOString().slice(0, 10) })
                .eq('id', id)
            if (error) throw error
            refetch()
        } catch (err) {
            alert('Failed to update: ' + err.message)
        } finally {
            setMarkingPaid(null)
        }
    }

    const unpaidTotal = logs
        .filter(l => !l.is_paid)
        .reduce((sum, l) => sum + Number(l.payment_amount), 0)

    if (isLoading) return <div className="page-loading"><div className="spinner" /> Loading…</div>

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Substitute Coaches</h1>
                    <p className="page-subtitle">Track all substitute deployments and payments.</p>
                </div>
                {unpaidTotal > 0 && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Outstanding</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--danger)', fontSize: '1.1rem' }}>
                            {formatCurrency(unpaidTotal)}
                        </div>
                    </div>
                )}
            </div>

            <div className="page-body">
                {error && (
                    <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: 'var(--danger)', fontSize: '0.875rem' }}>
                        <strong>Error:</strong> {error.message}
                    </div>
                )}

                {logs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔄</div>
                        <div className="empty-state-title">No Substitute Records</div>
                        <p className="empty-state-text">Mark attendance as SUB in the Attendance page to create a substitute record.</p>
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Substitute Logs ({logs.length})</h3>
                            {unpaidTotal > 0 && (
                                <span className="badge badge-danger">
                                    {logs.filter(l => !l.is_paid).length} unpaid
                                </span>
                            )}
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Substitute Name</th>
                                        <th>Mobile</th>
                                        <th>Sport</th>
                                        <th>Community</th>
                                        <th>Original Coach</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <tr key={log.id}>
                                            <td style={{ fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                                                {formatDate(log.date)}
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{log.substitute_coach_name}</td>
                                            <td style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.85rem' }}>
                                                {log.substitute_phone}
                                            </td>
                                            <td>{log.sports?.sport_name || '—'}</td>
                                            <td>{log.communities?.name || '—'}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                                {log.coaches?.name || '—'}
                                            </td>
                                            <td style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
                                                {formatCurrency(log.payment_amount)}
                                            </td>
                                            <td>
                                                {log.is_paid ? (
                                                    <span className="badge badge-success">Paid</span>
                                                ) : (
                                                    <span className="badge badge-danger">Unpaid</span>
                                                )}
                                            </td>
                                            <td>
                                                {!log.is_paid && (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        disabled={markingPaid === log.id}
                                                        onClick={() => markAsPaid(log.id)}
                                                    >
                                                        {markingPaid === log.id ? 'Saving…' : 'Mark Paid'}
                                                    </button>
                                                )}
                                                {log.is_paid && log.payment_date && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {formatDate(log.payment_date)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
