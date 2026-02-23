import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './router/ProtectedRoute'
import AppLayout from './components/Layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Communities from './pages/Communities'
import CommunityDetail from './pages/Communities/CommunityDetail'
import Coaches from './pages/Coaches'
import CoachDetail from './pages/Coaches/CoachDetail'
import PaidHolidays from './pages/PaidHolidays'
import Attendance from './pages/Attendance'
import Payroll from './pages/Payroll'
import Substitutes from './pages/Substitutes'
import Sports from './pages/Sports'
import AttendanceExport from './pages/AttendanceExport'

function App() {
    const { loading } = useAuth()

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '12px', color: 'var(--text-muted)' }}>
                <div className="spinner" />
                <span>Loading Athlio CoachOps…</span>
            </div>
        )
    }

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/communities" element={<Communities />} />
                    <Route path="/communities/:id" element={<CommunityDetail />} />
                    <Route path="/coaches" element={<Coaches />} />
                    <Route path="/coaches/:id" element={<CoachDetail />} />
                    <Route path="/paid-holidays" element={<PaidHolidays />} />
                    <Route path="/attendance" element={<Attendance />} />
                    <Route path="/payroll" element={<Payroll />} />
                    <Route path="/substitutes" element={<Substitutes />} />
                    <Route path="/sports" element={<Sports />} />
                    <Route path="/attendance-export" element={<AttendanceExport />} />
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
