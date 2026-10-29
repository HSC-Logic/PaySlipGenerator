import { Navigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

/** The app root: a restored session goes straight to the dashboard, everyone else to sign in. */
export function HomeRedirect() {
  const auth = useAuth()
  if (auth.loading) return <main className="route-state" role="status">Restoring your session…</main>
  return <Navigate to={auth.user ? '/dashboard' : '/login'} replace />
}
