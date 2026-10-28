import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
export function ProtectedRoute({ children }: { children: React.ReactNode }) { const auth = useAuth(); const location = useLocation(); if (auth.loading) return <main className="route-state" role="status">Restoring your session…</main>; if (!auth.user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />; return children }
