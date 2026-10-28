import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { cloudDataEnabled } from '../../services/cloud'

export const LAPSED_NOTICE = 'Your Slipy Pro has ended. Your cloud data is kept for 14 days after it ended, then archived for 24 months. Renew to get it back, download it now, or contact HSClogic support.'

/** Shown instead of any cloud screen when the account is not Pro. Makes no API calls. */
export function UpgradePanel({ feature = 'Cloud sync' }: { feature?: string }) {
  const auth = useAuth()
  if (!cloudDataEnabled) return <section className="settings-card upgrade-panel" role="status"><h2>{feature} is not available</h2><p>Cloud features are not configured for this deployment. Everything in the browser keeps working.</p><div className="quick-actions"><Link className="button secondary" to="/">Back to the editor</Link></div></section>
  return <section className="settings-card upgrade-panel" role="status"><h2>{feature} is a Slipy Pro feature</h2>
    {auth.lapsed ? <p>{LAPSED_NOTICE}</p> : <p>Pro adds cloud sync for payments, companies and recipients across devices, Google Drive and attribution removal. The browser editor stays free, with no limits.</p>}
    <div className="quick-actions"><Link className="button primary" to="/plans">{auth.lapsed ? 'Renew Slipy Pro' : 'See Slipy Pro'}</Link>{auth.lapsed && <Link className="button secondary" to="/settings">Download my data</Link>}<Link className="button secondary" to="/">Back to the editor</Link></div></section>
}
