import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
    const { data: coaches } = useQuery({
        queryKey: ['coaches-count'],
        queryFn: async () => {
            const { count } = await supabase.from('coaches').select('*', { count: 'exact', head: true }).eq('status', 'active')
            return count ?? 0
        },
    })

    const { data: communities } = useQuery({
        queryKey: ['communities-count'],
        queryFn: async () => {
            const { count } = await supabase.from('communities').select('*', { count: 'exact', head: true }).eq('status', 'active')
            return count ?? 0
        },
    })

    const { data: pendingSubs } = useQuery({
        queryKey: ['pending-subs'],
        queryFn: async () => {
            const { count } = await supabase.from('substitute_logs').select('*', { count: 'exact', head: true }).eq('is_paid', false)
            return count ?? 0
        },
    })

    const now = new Date()
    const monthName = now.toLocaleString('default', { month: 'long' })
    const year = now.getFullYear()

    const stats = [
        { label: 'Active Coaches', value: coaches ?? '—', icon: '👤', accent: 'var(--primary)' },
        { label: 'Active Communities', value: communities ?? '—', icon: '🏘', accent: 'var(--accent)' },
        { label: 'Unpaid Substitutes', value: pendingSubs ?? '—', icon: '⚡', accent: 'var(--warning)' },
        { label: 'Current Month', value: monthName.slice(0, 3).toUpperCase(), icon: '📅', accent: 'var(--info)' },
    ]

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">{monthName} {year} — Overview</p>
                </div>
            </div>

            <div className="page-body">
                {/* Stats */}
                <div className="stats-grid mb-6">
                    {stats.map(({ label, value, icon, accent }) => (
                        <div key={label} className="stat-card" style={{ '--stat-accent': accent }}>
                            <span className="stat-icon">{icon}</span>
                            <div className="stat-value">{value}</div>
                            <div className="stat-label">{label}</div>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">Quick Actions</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                        {[
                            { label: 'Mark Attendance', href: '/attendance', icon: '✅', desc: 'Review this month' },
                            { label: 'Manage Holidays', href: '/paid-holidays', icon: '📅', desc: 'Set community PH' },
                            { label: 'Run Payroll', href: '/payroll', icon: '💰', desc: `${monthName} salaries` },
                            { label: 'Add Coach', href: '/coaches', icon: '➕', desc: 'New coach profile' },
                        ].map(({ label, href, icon, desc }) => (
                            <a
                                key={label}
                                href={href}
                                className="card"
                                style={{ textDecoration: 'none', display: 'block', padding: '16px', cursor: 'pointer' }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{icon}</div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>{label}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{desc}</div>
                            </a>
                        ))}
                    </div>
                </div>

                {/* Workflow Guide */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Monthly Workflow</h3>
                        <span className="badge badge-primary">Phase 1</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {[
                            { step: '1', title: 'Set Paid Holidays', desc: 'Mark community PH at month start', color: 'var(--primary)' },
                            { step: '2', title: 'Note Exceptions', desc: 'Mark Absent or Sub as they happen', color: 'var(--accent)' },
                            { step: '3', title: 'Review Attendance', desc: 'Confirm all exceptions at month end', color: 'var(--info)' },
                            { step: '4', title: 'Run Payroll', desc: 'Export CSV with calculated salaries', color: 'var(--success)' },
                        ].map(({ step, title, desc, color }) => (
                            <div key={step} style={{
                                flex: '1 1 180px',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '14px',
                                borderTop: `3px solid ${color}`,
                            }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color, marginBottom: '6px', fontWeight: 700 }}>
                                    STEP {step}
                                </div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '3px' }}>{title}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
