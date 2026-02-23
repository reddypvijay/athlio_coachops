import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
    const { signIn, session } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    if (session) return <Navigate to="/" replace />

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email || !password) {
            setError('Email and password are required.')
            return
        }
        setLoading(true)
        setError('')
        try {
            await signIn(email, password)
        } catch (err) {
            setError(err.message || 'Login failed. Check your credentials.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            {/* Background glow */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 0,
                background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,255,71,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', color: 'var(--primary)', letterSpacing: '0.08em', lineHeight: 1 }}>
                        COACHOPS
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Management System
                    </div>
                </div>

                {/* Card */}
                <div className="card" style={{ border: '1px solid var(--border-2)' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', marginBottom: '4px' }}>Sign In</h2>
                        <p className="text-muted text-sm">Access your CoachOps dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="input-group">
                            <label className="input-label" htmlFor="email">
                                Email <span className="required">*</span>
                            </label>
                            <input
                                id="email"
                                type="email"
                                className={`input${error ? ' error' : ''}`}
                                placeholder="admin@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete="email"
                                disabled={loading}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="password">
                                Password <span className="required">*</span>
                            </label>
                            <input
                                id="password"
                                type="password"
                                className={`input${error ? ' error' : ''}`}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="alert alert-danger" style={{ fontSize: '0.82rem' }}>
                                ⚠ {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ marginTop: '6px', justifyContent: 'center' }}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    Signing in…
                                </>
                            ) : (
                                'Sign In →'
                            )}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    CoachOps v1.0 · Secured with Supabase Auth
                </p>
            </div>
        </div>
    )
}
