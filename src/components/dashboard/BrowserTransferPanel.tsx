import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { describeField } from '../../services/api/client'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  countNewItems, describeCounts, failedBatchIndex, initialProgress, isComplete, itemKey, itemsWithOutcome, listTransferredComputers, loadDevice, loadMarker, movedToOtherAccount, notMovedCount, planTransfer, readBrowserData,
  removeBrowserCopy, runCopyBatch, runTransfer, saveDeviceLabel, saveMarker, summarize, totalItems, updateMarker,
  type ImportKind, type ImportMarker, type LocalData, type PostBatch, type TransferPlan, type TransferProgress, type TransferredComputer,
} from '../../features/migration/browserImport'

const kindNames: Record<ImportKind, [string, string]> = { company: ['company', 'companies'], recipient: ['recipient', 'recipients'], record: ['document', 'documents'], draft: ['draft', 'drafts'], design: ['design', 'designs'] }
const kindOrder: ImportKind[] = ['company', 'recipient', 'record', 'draft', 'design']
const name = (kind: ImportKind, count: number) => kindNames[kind][count === 1 ? 0 : 1]
const money = (value?: number) => value === undefined ? 'not stored' : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fieldList = (errors?: Record<string, string[]>) => Object.entries(errors ?? {}).flatMap(([key, messages]) => messages.map(message => `${describeField(key)}: ${message}`))

export interface BrowserTransferPanelProps {
  /** `dashboard` hides itself when there is nothing to move; `settings` always shows the status and the computers already moved. */
  variant?: 'dashboard' | 'settings'
  /** Test seam; defaults to POST /imports/browser. */
  post?: PostBatch
  storage?: Storage
}

export function BrowserTransferPanel({ variant = 'dashboard', post, storage = localStorage }: BrowserTransferPanelProps) {
  const auth = useAuth()
  const sub = auth.user?.id ?? ''
  const enabled = auth.cloudAccess && Boolean(sub)
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<LocalData | null>(null)
  const [newCount, setNewCount] = useState(0)
  const [label, setLabel] = useState('')
  const [sharedAck, setSharedAck] = useState(false)
  const [plan, setPlan] = useState<TransferPlan | null>(null)
  const [progress, setProgress] = useState<TransferProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [computers, setComputers] = useState<TransferredComputer[] | null>(null)
  const marker = useRef<ImportMarker | null>(null)
  const shared = useMemo(() => enabled && movedToOtherAccount(storage, sub), [enabled, storage, sub])

  const refresh = useCallback(async () => {
    marker.current = loadMarker(storage, sub)
    const local = await readBrowserData(storage, { includeDrafts: !marker.current })
    setData(local); setNewCount(marker.current ? await countNewItems(storage, marker.current) : 0); setLabel(loadDevice(storage).label); setReady(true)
  }, [sub, storage])
  useEffect(() => { if (enabled) void refresh().catch(() => setReady(true)) }, [enabled, refresh])
  useEffect(() => { if (enabled && variant === 'settings') void listTransferredComputers().then(setComputers).catch(() => setComputers(null)) }, [enabled, variant, progress])

  const execute = async (nextPlan: TransferPlan, start: TransferProgress) => {
    setRunning(true); setError('')
    try {
      await runTransfer(nextPlan, start, {
        post,
        onProgress: setProgress,
        onBatchSent: (_batch, response) => { marker.current = updateMarker(marker.current, nextPlan, response); saveMarker(storage, sub, marker.current) },
      })
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The transfer failed.') } finally { setRunning(false) }
  }

  const begin = async () => {
    if (!data) return
    setError(''); setNotice(''); setRunning(true)
    try {
      saveDeviceLabel(storage, label)
      const device = { ...loadDevice(storage), label: label.trim() || loadDevice(storage).label }
      const nextPlan = await planTransfer(data, device)
      const start = initialProgress(nextPlan)
      setPlan(nextPlan); setProgress(start)
      if (!nextPlan.batches.length) { setRunning(false); return }
      await execute(nextPlan, start)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The transfer could not start.'); setRunning(false) }
  }
  const retry = () => { if (plan && progress) void execute(plan, progress) }
  const importAsCopy = async (sourceIds: string[]) => {
    if (!plan || !progress) return
    setRunning(true); setError('')
    try {
      setProgress(await runCopyBatch(plan, progress, sourceIds, { post, onBatchSent: (_batch, response) => { marker.current = updateMarker(marker.current, plan, response); saveMarker(storage, sub, marker.current) } }))
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The copy could not be sent.') } finally { setRunning(false) }
  }
  const removeCopy = () => {
    if (!plan || !progress || !isComplete(progress)) return
    const staying = notMovedCount(plan, progress)
    const warning = staying ? `\n\n${staying} item${staying === 1 ? '' : 's'} could not be moved and will be deleted from this computer too.` : ''
    if (!confirm(`Remove this computer's copy of your Slipy data? Company, recipients, history, drafts and designs are deleted from this browser. Your cloud copy is not affected. This cannot be undone.${warning}`)) return
    const result = removeBrowserCopy(storage)
    if (!result.success) { setError('The browser copy could not be fully removed. Check your browser storage settings and try again.'); return }
    setNotice("This computer's copy was removed. Your data is in your cloud."); setPlan(null); setProgress(null); void refresh()
  }

  if (!enabled || !ready) return null
  const hasMarker = Boolean(marker.current)
  const localTotal = data ? totalItems(data.counts) : 0

  if (plan && progress) return <TransferResult plan={plan} progress={progress} running={running} error={error} onRetry={retry} onCopy={ids => void importAsCopy(ids)} onRemove={removeCopy} onDone={() => { setPlan(null); setProgress(null); void refresh() }} />

  const offer = !hasMarker ? localTotal > 0 : newCount > 0
  if (!offer && !notice && variant === 'dashboard') return null
  const title = hasMarker ? `This computer has ${newCount} new item${newCount === 1 ? '' : 's'} not in your cloud` : "Move this computer's Slipy data to your cloud"
  return <section className="transfer-panel" aria-label="Move this computer's data">
    {notice && <p role="status" className="transfer-note">{notice}</p>}
    {offer ? <>
      <h2>{title}</h2>
      {!hasMarker && data && <p>{describeCounts(data.counts)} found on this computer. Nothing is moved until you confirm. Documents can contain recipient identification and payment details; they are sent to your Slipy cloud over an encrypted connection. A copy stays in this browser as a backup.</p>}
      {hasMarker && <p>These were saved on this computer while you were signed out or on the Free plan. Moving them again never duplicates what is already in your cloud.</p>}
      {shared && !sharedAck && <div className="transfer-warning" role="alert"><strong>Shared computer?</strong> This browser's data was already moved to a different Slipy account. If this computer is shared, the data belongs to someone else and should not go into this account.<div><button className="button secondary" type="button" onClick={() => setSharedAck(true)}>This is my data, continue</button></div></div>}
      {(!shared || sharedAck) && <>
        <label className="field transfer-label"><span>Computer name</span><input value={label} maxLength={100} onChange={event => setLabel(event.target.value)} /></label>
        <div className="inline-actions"><button className="button primary" type="button" disabled={running || !label.trim()} onClick={() => void begin()}>{running ? 'Preparing…' : hasMarker ? 'Move new items' : 'Move to my cloud'}</button></div>
      </>}
      {error && <p role="alert" className="transfer-error">{error}</p>}
    </> : <p role="status">{variant === 'settings' ? 'Everything on this computer is already in your cloud.' : null}</p>}
    {variant === 'settings' && computers && computers.length > 0 && <div className="transfer-computers"><h3>Computers already moved</h3><ul className="cloud-list">{computers.map(computer => <li key={computer.id}><strong>{computer.label}</strong><span>{kindOrder.filter(kind => computer.counts?.[kind]).map(kind => `${computer.counts[kind]} ${name(kind, computer.counts[kind] ?? 0)}`).join(', ') || 'No items'}</span><span>{computer.lastImportAt ? new Date(computer.lastImportAt).toLocaleDateString() : ''}</span></li>)}</ul></div>}
  </section>
}

function TransferResult({ plan, progress, running, error, onRetry, onCopy, onRemove, onDone }: { plan: TransferPlan; progress: TransferProgress; running: boolean; error: string; onRetry: () => void; onCopy: (sourceIds: string[]) => void; onRemove: () => void; onDone: () => void }) {
  const sent = progress.batches.filter(batch => batch.status === 'sent').length
  const failedAt = failedBatchIndex(progress)
  const failure = failedAt >= 0 ? progress.batches[failedAt] : null
  const complete = isComplete(progress)
  const summary = summarize(plan, progress)
  const labelOf = (kind: ImportKind, sourceId: string) => plan.items.get(itemKey(kind, sourceId))?.label ?? sourceId
  const invalid = itemsWithOutcome(progress, 'invalid')
  const changed = itemsWithOutcome(progress, 'changedLocally')
  const review = progress.merged.length + Object.keys(progress.referenceConflicts).length + progress.totalsDifferences.length + changed.length
  const rows = kindOrder.map(kind => ({ kind, row: summary[kind] })).filter(({ row }) => Object.values(row).some(Boolean))
  return <section className="transfer-panel" aria-label="Transfer to your cloud" aria-busy={running}>
    <h2>{complete ? 'Transfer finished' : failure ? 'Transfer stopped' : 'Moving your data'}</h2>
    {plan.batches.length === 0 && <p role="status">Nothing could be sent from this computer.</p>}
    {plan.batches.length > 0 && <div className="transfer-progress"><progress max={plan.batches.length} value={sent} aria-label="Transfer progress" /><p role="status">{complete ? `All ${plan.batches.length} batch${plan.batches.length === 1 ? '' : 'es'} sent.` : `Sent ${sent} of ${plan.batches.length} batch${plan.batches.length === 1 ? '' : 'es'}${running ? '…' : '.'}`}</p></div>}
    {failure && failure.status === 'failed' && <div className="transfer-warning" role="alert"><strong>Batch {failedAt + 1} failed.</strong> {failure.message} Nothing was lost; sending it again never creates duplicates.<div><button className="button primary" type="button" disabled={running} onClick={onRetry}>{running ? 'Retrying…' : 'Retry from batch ' + (failedAt + 1)}</button></div></div>}
    {error && <p role="alert" className="transfer-error">{error}</p>}
    {rows.length > 0 && <table className="transfer-table"><caption className="sr-only">Transfer summary by kind</caption><thead><tr><th scope="col">Kind</th><th scope="col">Created</th><th scope="col">Already in your cloud</th><th scope="col">Not moved</th></tr></thead>
      <tbody>{rows.map(({ kind, row }) => <tr key={kind}><th scope="row">{name(kind, 2)}</th><td>{row.created}</td><td>{row.matched + row.alreadyImported}</td><td>{row.invalid + row.tooLarge + row.changedLocally}</td></tr>)}</tbody></table>}
    {review > 0 && <div className="transfer-section"><h3>Needs review</h3>
      {Object.values(progress.referenceConflicts).length > 0 && <><h4>Shared references</h4><ul className="transfer-list">{Object.values(progress.referenceConflicts).map(conflict => <li key={conflict.reference}>{conflict.count} documents share <strong>{conflict.reference}</strong>. Both keep the reference they were issued with.</li>)}</ul></>}
      {progress.totalsDifferences.length > 0 && <><h4>Totals that differ</h4><ul className="transfer-list">{progress.totalsDifferences.map(difference => <li key={`${difference.kind}:${difference.sourceId}`}><strong>{difference.reference || labelOf(difference.kind, difference.sourceId)}</strong>: this computer stored a total of {money(difference.stored?.finalTotal)}; Slipy recalculated {money(difference.recalculated?.finalTotal)}. The recalculated amount is used.</li>)}</ul></>}
      {progress.merged.length > 0 && <><h4>Linked to existing entries</h4><ul className="transfer-list">{progress.merged.map(merge => <li key={`${merge.kind}:${merge.targetId}:${merge.name}`}>"{merge.name}" on this computer was linked to your existing {kindNames[merge.kind][0]} "{merge.targetName ?? merge.name}". Documents keep their original details.</li>)}</ul></>}
      {changed.length > 0 && <><h4>Changed on this computer since the transfer</h4><ul className="transfer-list">{changed.map(item => <li key={item.sourceId}><strong>{labelOf(item.kind, item.sourceId)}</strong> was edited after it was moved. The cloud copy was not changed. {item.kind === 'record' && <button className="text-button" type="button" disabled={running} onClick={() => onCopy([item.sourceId])}>Import as a copy</button>}</li>)}</ul></>}
    </div>}
    {(invalid.length > 0 || plan.localInvalid.length > 0) && <div className="transfer-section"><h3>Not moved</h3><p>These stay on this computer.</p><ul className="transfer-list">
      {invalid.map(item => <li key={itemKey(item.kind, item.sourceId)}><strong>{labelOf(item.kind, item.sourceId)}</strong> ({kindNames[item.kind][0]}): {item.reason ?? 'not valid'}{fieldList(item.errors).length > 0 && <ul>{fieldList(item.errors).map(text => <li key={text}>{text}</li>)}</ul>}</li>)}
      {plan.localInvalid.map(item => <li key={itemKey(item.kind, item.sourceId)}><strong>{item.label}</strong> ({kindNames[item.kind][0]}): too large to send.</li>)}
    </ul></div>}
    {(plan.logoWarnings.length > 0 || progress.warnings.length > 0) && <div className="transfer-section"><h3>Warnings</h3><ul className="transfer-list">{plan.logoWarnings.map(warning => <li key={warning.key}>{warning.message}</li>)}{progress.warnings.map(warning => <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>)}</ul></div>}
    {complete && <div className="transfer-section"><p>A copy of your data is kept in this browser as a read-only backup, shown as "On this computer only".</p>
      <div className="inline-actions"><button className="button secondary" type="button" onClick={onDone}>Done</button><button className="button danger-subtle" type="button" onClick={onRemove}>Remove this computer's copy</button></div></div>}
  </section>
}
