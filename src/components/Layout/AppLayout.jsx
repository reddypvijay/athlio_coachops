import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = [
    { to: '/', icon: '⬡', label: 'Dashboard' },
    { to: '/communities', icon: '🏘', label: 'Communities' },
    { to: '/sports', icon: '🏅', label: 'Sports' },
    { to: '/coaches', icon: '👤', label: 'Coaches' },
    { to: '/paid-holidays', icon: '📅', label: 'Paid Holidays' },
    { to: '/attendance', icon: '✅', label: 'Attendance' },
    { to: '/payroll', icon: '💰', label: 'Payroll' },
    { to: '/payments', icon: '💳', label: 'Payments' },
    { to: '/attendance-export', icon: '📊', label: 'Attendance Export' },
    { to: '/substitutes', icon: '🔄', label: 'Substitute Coaches' },
]

export default function AppLayout() {
    const { user, signOut } = useAuth()
    const initials = user?.email?.[0]?.toUpperCase() ?? 'A'

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-text">ATHLIO COACHOPS</div>
                    <div className="sidebar-logo-sub">Management System</div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-label">Navigation</div>
                    {NAV.map(({ to, icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        >
                            <span className="nav-icon">{icon}</span>
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-email">{user?.email}</div>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm w-full" onClick={signOut}>
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}
