import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const showToast = useCallback((message, type = 'success', duration = 3000) => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast container — fixed, top-right */}
            <div style={{
                position: 'fixed',
                top: 24,
                right: 24,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                pointerEvents: 'none',
            }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 18px',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        animation: 'slideInFade 0.3s ease',
                        ...(t.type === 'success' ? {
                            background: 'rgba(20,40,25,0.97)',
                            border: '1px solid var(--success)',
                            color: 'var(--success)',
                        } : t.type === 'error' ? {
                            background: 'rgba(40,15,15,0.97)',
                            border: '1px solid var(--danger)',
                            color: 'var(--danger)',
                        } : {
                            background: 'rgba(30,35,45,0.97)',
                            border: '1px solid var(--info)',
                            color: 'var(--info)',
                        }),
                    }}>
                        <span style={{ fontSize: '1.1rem' }}>
                            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
                        </span>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}
