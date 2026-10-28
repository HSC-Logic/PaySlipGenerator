import { Outlet } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { UpgradePanel } from '../common/UpgradePanel'

/** Layout route for cloud screens. Children mount (and call the API) only when the token carries `slipy-pro`. */
export function ProGate({ children }: { children?: React.ReactNode }) {
  const auth = useAuth()
  if (!auth.cloudAccess) return <main className="cloud-page"><UpgradePanel /></main>
  return children ?? <Outlet />
}
