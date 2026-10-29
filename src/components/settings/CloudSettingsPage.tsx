import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { downloadAccountExport, deleteSlipyData, supportMailto } from '../../features/account/accountData'
import { ApiError, fetchMe, type Me } from '../../services/api/client'
import { cloudDataEnabled } from '../../services/cloud'
import { BrowserTransferPanel } from '../dashboard/BrowserTransferPanel'
import { LAPSED_NOTICE, UpgradePanel } from '../common/UpgradePanel'

const messageOf = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback
const archivedError = (error: unknown) => error instanceof ApiError && error.kind === 'data-archived'

function ExportButton({ onArchived }: { onArchived?: () => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const run = async () => {
    setBusy(true); setMessage('')
    try { setMessage(`Saved ${await downloadAccountExport()}. Keep it somewhere safe: it is the only copy outside Slipy.`) }
    catch (error) { if (archivedError(error) && onArchived) onArchived(); else setMessage(messageOf(error, 'Could not download your data.')) }
    finally { setBusy(false) }
  }
  return <div className="settings-action"><button className="button secondary" disabled={busy} onClick={() => void run()}>{busy ? 'Preparing…' : 'Download my data'}</button>{message && <p role="status" className="settings-note">{message}</p>}</div>
}

function DeleteData({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false); const [typed, setTyped] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [done, setDone] = useState(false)
  const remove = async () => {
    setBusy(true); setMessage('')
    try { await deleteSlipyData(); setDone(true); setOpen(false) } catch (error) { setMessage(messageOf(error, 'Could not delete your data.')) } finally { setBusy(false) }
  }
  if (done) return <p role="status">Your Slipy data was deleted. Your HSClogic account was not deleted and still works in other HSClogic apps.</p>
  return <div className="settings-action settings-danger">{!open ? <div className="settings-row"><div><strong>Delete my Slipy data</strong><p>Permanently remove everything stored in Slipy. Your HSClogic account is kept.</p></div><button className="button danger-subtle" onClick={() => setOpen(true)}>Delete my Slipy data</button></div> : <div role="group" aria-label="Delete my Slipy data">
    <p>This permanently deletes your payments, companies, recipients, logos and designs stored in Slipy, disconnects Google Drive and removes any archived copies. It cannot be undone. Your HSClogic account is kept, because it also signs in to other HSClogic apps. Download your data first.</p>
    <ExportButton /><label>Type DELETE to confirm<input value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" /></label>
    <div className="quick-actions"><button className="button danger-subtle" disabled={busy || typed !== 'DELETE'} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete everything'}</button><button className="button secondary" disabled={busy} onClick={() => { setOpen(false); setTyped('') }}>Cancel</button></div>
    <p><small>Signed in as {userId}.</small></p></div>}{message && <p role="alert">{message}</p>}</div>
}

function ProData({ userId }: { userId: string }) {
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => { fetchMe().then(setMe).catch(() => setMe(null)) }, [])
  return <section className="settings-section"><div className="settings-section-head"><h2>Your Slipy data</h2><p>Payments, companies, recipients and logos are stored in your Slipy cloud. You can take a full copy or remove it at any time.</p></div><div className="settings-body">
    <BrowserTransferPanel variant="settings" />
    <div className="settings-row"><div><strong>Download a copy</strong><p>A file with everything stored in your Slipy cloud.</p></div><ExportButton /></div>{!!me?.archives?.length && <p>You have {me.archives.length} earlier archive{me.archives.length > 1 ? 's' : ''} (latest {new Date(me.archives[me.archives.length - 1].createdAt).toLocaleDateString()}). <a href={supportMailto('archived-data', userId)}>Request my archived data</a></p>}
    <DeleteData userId={userId} /></div></section>
}

function LapsedData({ userId }: { userId: string }) {
  const [archived, setArchived] = useState(false)
  return <section className="settings-section"><div className="settings-section-head"><h2>Your Slipy data</h2></div><div className="settings-body"><p role="status">{LAPSED_NOTICE}</p>
    <div className="quick-actions"><Link className="button primary" to="/plans">Renew Slipy Pro</Link>
      {archived ? <a className="button secondary" href={supportMailto('archived-data', userId)}>Request my archived data</a> : <ExportButton onArchived={() => setArchived(true)} />}
      <a className="button danger-subtle" href={supportMailto('delete-data', userId)}>Delete my Slipy data</a></div>
    {archived && <p role="status">Your data has already been archived. Contact HSClogic support to receive it.</p>}
    <p>Deleting your data is handled by HSClogic support, who confirm the request through your account's verified email. Google Drive access stays connected until your data is archived. You can remove it at any time from your Google account (Google Account, Security, Third-party connections).</p></div></section>
}

export function CloudSettingsPage() {
  const auth = useAuth()
  const userId = auth.user?.id ?? ''
  const plan = auth.plan === 'pro' ? 'Pro' : auth.lapsed ? 'Pro ended' : 'Free'
  return <main className="cloud-page settings-page"><h1>Account settings</h1>
    <section className="settings-section"><div className="settings-section-head"><h2>Account</h2><p>Your HSClogic account is shared with other HSClogic apps.</p></div>
      <div className="settings-body"><dl className="settings-facts"><div><dt>Email</dt><dd>{auth.user?.email}</dd></div><div><dt>Plan</dt><dd><span className={`plan-badge${auth.plan === 'pro' ? ' pro' : ''}`}>{plan}</span></dd></div></dl>
      <p className="settings-note">Plan changes are administrator-controlled; there is no client-side Pro switch.</p></div></section>
    {cloudDataEnabled && (auth.cloudAccess ? <ProData userId={userId} /> : auth.lapsed ? <LapsedData userId={userId} /> : <UpgradePanel />)}
    <section className="settings-section"><div className="settings-section-head"><h2>Privacy</h2></div><div className="settings-body"><p>Free accounts keep every document in this browser; nothing is sent to Slipy servers. Pro accounts also store payments, companies and recipients in the Slipy cloud. Signing out does not delete cloud records or local browser data.</p></div></section>
  </main>
}
