import { useEffect, useRef, useState } from 'react'
import type { PaymentSlip } from '../../types'
import { findUnsavedQuickParts, saveQuickSlipParts, type QuickSaveResult } from '../../services/cloudSave'

/** Asks, after a quick slip is generated, what (if anything) to keep in the Slipy cloud. Closing it saves nothing. */
export function QuickSaveDialog({ slip, preferredCompanyId = '', onClose, onSaved }: { slip: PaymentSlip; preferredCompanyId?: string; onClose: () => void; onSaved: (result: QuickSaveResult) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [parts, setParts] = useState<{ company: boolean; recipient: boolean; hasCompany: boolean } | null>(null)
  const [choice, setChoice] = useState({ saveSlip: true, saveRecipient: true, saveCompany: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => { findUnsavedQuickParts(slip, preferredCompanyId).then(setParts).catch(() => setParts({ company: true, recipient: !!slip.recipient.name.trim(), hasCompany: false })) }, [slip, preferredCompanyId])
  const toggle = (key: keyof typeof choice) => setChoice(current => ({ ...current, [key]: !current[key] }))
  const save = async () => {
    setBusy(true); setError('')
    try { onSaved(await saveQuickSlipParts({ source: slip, preferredCompanyId, saveSlip: choice.saveSlip, saveRecipient: !!parts?.recipient && choice.saveRecipient, saveCompany: !!parts?.company && choice.saveCompany })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save to your cloud. Your slip is unchanged.'); setBusy(false) }
  }
  const nothing = !choice.saveSlip && !(parts?.recipient && choice.saveRecipient) && !(parts?.company && choice.saveCompany)
  return <dialog ref={dialog} className="quick-save-dialog" aria-labelledby="quick-save-title" onClose={onClose} onCancel={onClose}>
    <h2 id="quick-save-title">Keep this in your Slipy cloud?</h2>
    <p>Your PDF is ready. Saving is optional, and you can skip it.</p>
    {!parts ? <p role="status">Checking what is already saved…</p> : <div className="quick-save-options">
      <label><input type="checkbox" checked={choice.saveSlip} onChange={() => toggle('saveSlip')} /><span><strong>This payment slip</strong><small>{slip.payment.title || 'Untitled payment'}, added to your history</small></span></label>
      {parts.recipient && <label><input type="checkbox" checked={choice.saveRecipient} onChange={() => toggle('saveRecipient')} /><span><strong>Recipient</strong><small>{slip.recipient.name}, reusable on future slips</small></span></label>}
      {parts.company && <label><input type="checkbox" checked={choice.saveCompany || (choice.saveSlip && !parts.hasCompany)} disabled={choice.saveSlip && !parts.hasCompany} onChange={() => toggle('saveCompany')} /><span><strong>Company details</strong><small>{slip.company.name || 'Your company'}{choice.saveSlip && !parts.hasCompany ? ', needed to save the slip' : ', reusable on future slips'}</small></span></label>}
    </div>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="quick-save-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => dialog.current?.close()}>Not now</button><button type="button" className="button primary" disabled={busy || !parts || nothing} onClick={() => void save()}>{busy ? 'Saving…' : 'Save selected'}</button></div>
  </dialog>
}
