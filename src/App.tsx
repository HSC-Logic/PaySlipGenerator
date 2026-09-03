import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Cloud, CopyPlus, Download, Eye, FilePlus2, FolderOpen, HardDrive, LoaderCircle, LockKeyhole, Moon, PlugZap, Printer, RotateCcw, Save, ShieldCheck, Sun, Unplug } from 'lucide-react'
import { SlipForm } from './components/forms/SlipForm'
import { ReviewPanel } from './components/forms/ReviewPanel'
import { PaymentSlipPreview } from './components/preview/PaymentSlipPreview'
import { PaymentHistory } from './components/history/PaymentHistory'
import { PrivacyControls } from './components/privacy/PrivacyControls'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { WorkflowStepper, workflowSteps } from './components/common/WorkflowStepper'
import type { AppSettings, GoogleDriveState, PaymentRecord, PaymentSlip, SavedRecipient, WorkflowStep } from './types'
import { calculatePaymentTotals, formatCurrency } from './utils/currency'
import { currentOrNextReference, generateReference } from './utils/reference'
import { errorsForStep, validateSlip } from './utils/validation'
import { buildPdf, downloadPdfDocument, printPdfDocument } from './utils/pdf'
import { runDocumentAction } from './utils/documentActions'
import { createSimilarSlip } from './utils/similarSlip'
import { copySlip, prepareDestructiveReplacement } from './utils/dirtyState'
import { clearAllSliplyData, clearCompanyProfile, clearDraftData, clearHistoryData, clearRecipientData, clearRecovery, clearReferenceData, DEFAULT_SETTINGS, loadCompanyProfile, loadDraft as loadStoredDraft, loadHistory, loadRecovery, loadRecipients, loadSettings, normalizeReferencePrefix, persistenceMessage, saveCompany as saveStoredCompany, saveDraft as saveStoredDraft, saveHistory as saveStoredHistory, saveRecipients as saveStoredRecipients, saveSettings, type PersistenceResult } from './utils/storage'
import { loadMeaningfulRecovery, persistRecoveryState } from './utils/recovery'
import { chooseFolder, connectDrive, createGoogleDoc, disconnectDrive, driveConfigured } from './services/googleDrive'

const today = () => new Date().toLocaleDateString('en-CA')
const blank = (currency = DEFAULT_SETTINGS.defaultCurrency): PaymentSlip => ({ company: { name: '', address: '', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#0b1f3a' }, recipient: { name: '', identification: '', role: '', address: '', email: '', telephone: '' }, payment: { date: today(), reference: '', title: '', method: 'Cash', status: 'draft', paidDate: '', paidReference: '', bankName: '', transactionReference: '', notes: '', adjustment: 0, currency, sealText: '', paperSize: 'a4', orientation: 'portrait' }, items: [{ id: crypto.randomUUID(), description: '', quantity: 1, rate: 0 }], adjustments: [] })
type Notice = { kind: 'success' | 'error'; text: string } | null
const persistedReferences = () => { const defaults = blank(); const draft = loadStoredDraft(localStorage, defaults); const recovery = loadRecovery(localStorage, defaults); const history = loadHistory(localStorage, defaults); return [draft?.payment.reference, recovery?.slip.payment.reference, ...history.map(record => record.slip.payment.reference)].filter((value): value is string => Boolean(value)) }

const initialPaymentState = () => {
  const settings = loadSettings(localStorage)
  const defaults = blank(settings.defaultCurrency)
  const profile = loadCompanyProfile(localStorage, defaults.company)
  const initial = { ...defaults, company: profile ?? defaults.company }
  const recovery = loadMeaningfulRecovery(localStorage, initial)
  return recovery
    ? { slip: recovery.slip, baseline: recovery.baseline, recovered: true, hasProfile: profile !== null, settings }
    : { slip: initial, baseline: initial, recovered: false, hasProfile: profile !== null, settings }
}

export default function App() {
  const [startup] = useState(initialPaymentState)
  const [slip, setSlip] = useState<PaymentSlip>(startup.slip)
  const [settings, setSettings] = useState<AppSettings>(startup.settings)
  const [hasCompanyProfile, setHasCompanyProfile] = useState(startup.hasProfile)
  const [savedRecipients, setSavedRecipients] = useState(() => loadRecipients(localStorage))
  const [selectedRecipientId, setSelectedRecipientId] = useState('')
  const [history, setHistory] = useState(() => loadHistory(localStorage, blank()).sort((a, b) => b.updatedAt - a.updatedAt))
  const [historyQuery, setHistoryQuery] = useState('')
  const [activeRecordId, setActiveRecordId] = useState('')
  const cleanSlip = useRef<PaymentSlip>(copySlip(startup.baseline))
  const [darkMode, setDarkMode] = useState(() => startup.settings.theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : startup.settings.theme === 'dark')
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [activeStep, setActiveStep] = useState<WorkflowStep>('company'); const [highestStep, setHighestStep] = useState(0); const [attemptedStep, setAttemptedStep] = useState<WorkflowStep | null>(null)
  const [attempted, setAttempted] = useState(false); const [notice, setNotice] = useState<Notice>(startup.recovered ? { kind: 'success', text: 'Recovered your unsaved payment slip from this device.' } : null); const [busy, setBusy] = useState('')
  const [storageWarning, setStorageWarning] = useState('')
  const [drive, setDrive] = useState<GoogleDriveState>({ connected: false, folderId: '', folderName: '', documentUrl: '' })
  const preview = useRef<HTMLDivElement>(null); const referenceInitialized = useRef(false); const allErrors = useMemo(() => validateSlip(slip), [slip]); const visibleErrors = attempted || attemptedStep === activeStep ? errorsForStep(allErrors, activeStep) : {}
  const valid = Object.keys(allErrors).length === 0; const calculation = useMemo(() => calculatePaymentTotals(slip.items, slip.payment.adjustment, slip.adjustments), [slip.items, slip.payment.adjustment, slip.adjustments]); const total = calculation.final
  const filteredHistory = useMemo(() => { const query = historyQuery.trim().toLocaleLowerCase(); if (!query) return history; return history.filter(record => [record.slip.payment.reference, record.slip.recipient.name, record.slip.company.name, record.slip.payment.title, record.slip.payment.status].some(value => value.toLocaleLowerCase().includes(query))) }, [history, historyQuery])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 4500); return () => clearTimeout(timer) }, [notice])
  const recordBackgroundPersistence = (result: PersistenceResult) => { if (!result.success) setStorageWarning(persistenceMessage(result, 'Automatic recovery')); else setStorageWarning('') }
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? 'dark' : 'light' }, [darkMode])
  const toggleDarkMode = () => { const next = !darkMode; const nextSettings = { ...settings, theme: next ? 'dark' as const : 'light' as const }; const result = saveSettings(localStorage, nextSettings); if (!result.success) return tell('error', persistenceMessage(result, 'Settings')); setDarkMode(next); setSettings(nextSettings) }
  const updateSettings = (candidate: AppSettings) => { const prefix = normalizeReferencePrefix(candidate.referencePrefix); if (prefix !== candidate.referencePrefix.trim().toUpperCase()) return tell('error', 'Reference prefix may contain letters, numbers, and single hyphens only.'); const next = { ...candidate, referencePrefix: prefix }; const result = saveSettings(localStorage, next); if (!result.success) return tell('error', persistenceMessage(result, 'Settings')); setSettings(next); tell('success', 'Settings saved. New payments will use these defaults.') }
  useEffect(() => { if (referenceInitialized.current) return; referenceInitialized.current = true; setSlip(current => { if (current.payment.reference) return current; const next = { ...current, payment: { ...current.payment, reference: currentOrNextReference({ prefix: settings.referencePrefix, existingReferences: persistedReferences(), onPersistenceFailure: recordBackgroundPersistence }) } }; cleanSlip.current = copySlip(next); return next }) }, [])
  useEffect(() => {
    const persist = () => { recordBackgroundPersistence(persistRecoveryState(localStorage, slip, cleanSlip.current)) }
    const timer = window.setTimeout(persist, 750)
    window.addEventListener('pagehide', persist)
    return () => { window.clearTimeout(timer); window.removeEventListener('pagehide', persist) }
  }, [slip])
  const tell = (kind: 'success' | 'error', text: string) => setNotice({ kind, text })
  const focusError = (key: string) => requestAnimationFrame(() => { const control = document.querySelector<HTMLElement>(`[data-error-key="${CSS.escape(key)}"]`); control?.focus({ preventScroll: true }); control?.scrollIntoView({ behavior: 'smooth', block: 'center' }) })
  const requireValid = (action: () => void) => { setAttempted(true); if (!valid) { const first = Object.keys(allErrors)[0]; const targetStep: WorkflowStep = first.startsWith('company.') ? 'company' : first.startsWith('recipient.') ? 'recipient' : 'payment'; setHighestStep(value => Math.max(value, workflowSteps.findIndex(item => item.id === targetStep))); setActiveStep(targetStep); setAttemptedStep(targetStep); setMobileView('edit'); tell('error', 'Please fix the highlighted field before generating the slip.'); focusError(first); return } action() }
  const saveDraft = () => { const result = saveStoredDraft(localStorage, slip); if (!result.success) return tell('error', persistenceMessage(result, 'The draft')); cleanSlip.current = copySlip(slip); recordBackgroundPersistence(clearRecovery(localStorage)); tell('success', 'Draft saved on this device.') }
  const saveCompany = () => { const result = saveStoredCompany(localStorage, slip.company); if (!result.success) return tell('error', persistenceMessage(result, 'The company profile')); setHasCompanyProfile(true); cleanSlip.current = { ...cleanSlip.current, company: { ...slip.company } }; recordBackgroundPersistence(persistRecoveryState(localStorage, slip, cleanSlip.current)); tell('success', hasCompanyProfile ? 'Company profile updated on this device.' : 'Company profile saved on this device.') }
  const clearCompany = () => { if (!confirm('Clear the saved company profile? The company details in this payment slip will remain unchanged.')) return; const result = clearCompanyProfile(localStorage); if (!result.success) return tell('error', persistenceMessage(result, 'The company profile')); setHasCompanyProfile(false); tell('success', 'Saved company profile cleared. This payment slip was not changed.') }
  const savedRecipientSnapshot = (id: string): SavedRecipient => ({ id, name: slip.recipient.name.trim(), role: slip.recipient.role, address: slip.recipient.address, email: slip.recipient.email, telephone: slip.recipient.telephone })
  const saveRecipient = () => {
    if (!slip.recipient.name.trim()) return tell('error', 'Enter a recipient name before saving this recipient.')
    const id = selectedRecipientId || crypto.randomUUID()
    const snapshot = savedRecipientSnapshot(id)
    const next = selectedRecipientId ? savedRecipients.map(recipient => recipient.id === id ? snapshot : recipient) : [...savedRecipients, snapshot]
    const result = saveStoredRecipients(localStorage, next)
    if (!result.success) return tell('error', persistenceMessage(result, 'The recipient'))
    setSavedRecipients(next); setSelectedRecipientId(id); tell('success', selectedRecipientId ? 'Saved recipient updated. Existing payment records were not changed.' : 'Recipient saved without NIC / ID.')
  }
  const selectRecipient = (id: string) => {
    if (!id) { setSelectedRecipientId(''); return }
    const saved = savedRecipients.find(recipient => recipient.id === id)
    if (!saved) { setSelectedRecipientId(''); return tell('error', 'That saved recipient is no longer available.') }
    const hasCurrentDetails = Object.values(slip.recipient).some(value => value.trim() !== '')
    if (hasCurrentDetails && !confirm('Replace the recipient details in this payment slip with the selected saved recipient?')) return
    setSlip({ ...slip, recipient: { name: saved.name, role: saved.role, address: saved.address, email: saved.email, telephone: saved.telephone, identification: '' } })
    setSelectedRecipientId(id)
  }
  const deleteRecipient = () => {
    if (!selectedRecipientId || !confirm('Delete this saved recipient? The recipient details in this payment slip and existing drafts will remain unchanged.')) return
    const next = savedRecipients.filter(recipient => recipient.id !== selectedRecipientId)
    const result = saveStoredRecipients(localStorage, next)
    if (!result.success) return tell('error', persistenceMessage(result, 'The saved recipient'))
    setSavedRecipients(next); setSelectedRecipientId(''); tell('success', 'Saved recipient deleted. This payment slip was not changed.')
  }
  const saveRecord = () => {
    if (!valid) return requireValid(() => undefined)
    const now = Date.now()
    const existing = history.find(record => record.id === activeRecordId)
    const record: PaymentRecord = { id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now, slip: copySlip(slip) }
    const next = [record, ...history.filter(item => item.id !== record.id)]
    const result = saveStoredHistory(localStorage, next)
    if (!result.success) return tell('error', persistenceMessage(result, 'The payment record'))
    setHistory(next); setActiveRecordId(record.id); cleanSlip.current = copySlip(slip); recordBackgroundPersistence(clearRecovery(localStorage)); tell('success', existing ? 'Payment record updated.' : 'Payment added to history.')
  }
  const resetWorkflow = () => { setActiveStep('company'); setHighestStep(0); setAttemptedStep(null); setAttempted(false); setMobileView('edit') }
  const acceptReplacement = (next: PaymentSlip, recordId = '') => { recordBackgroundPersistence(clearRecovery(localStorage)); cleanSlip.current = copySlip(next); setSlip(next); setSelectedRecipientId(''); setActiveRecordId(recordId); resetWorkflow() }
  const destructiveReplacement = (message: string, createReplacement: () => PaymentSlip) => prepareDestructiveReplacement({ current: slip, baseline: cleanSlip.current, confirmDiscard: () => confirm(message), createReplacement })
  const loadDraft = () => { const draft = loadStoredDraft(localStorage, blank()); if (!draft) return tell('error', 'No valid saved draft was found on this device.'); const next = destructiveReplacement('Load the saved draft? Unsaved changes to this slip will be lost.', () => draft); if (!next) return; acceptReplacement(next); tell('success', 'Draft loaded.') }
  const clear = () => { const next = destructiveReplacement('Clear this payment slip? Unsaved information will be lost.', () => { const cleared = blank(settings.defaultCurrency); cleared.company = copySlip(slip).company; cleared.payment.reference = slip.payment.reference || currentOrNextReference({ prefix: settings.referencePrefix, existingReferences: persistedReferences(), onPersistenceFailure: recordBackgroundPersistence }); return cleared }); if (!next) return; acceptReplacement(next); tell('success', 'Form cleared. Company details and payment reference were kept.') }
  const another = () => { const next = destructiveReplacement('Create a new blank slip? Unsaved changes to this slip will be lost.', () => { const created = blank(settings.defaultCurrency); created.company = loadCompanyProfile(localStorage, created.company) ?? created.company; created.payment.reference = generateReference({ prefix: settings.referencePrefix, existingReferences: persistedReferences(), onPersistenceFailure: recordBackgroundPersistence }); return created }); if (!next) return; acceptReplacement(next); scrollTo({ top: 0, behavior: 'smooth' }); tell('success', 'A new payment slip is ready.') }
  const similar = () => { const next = createSimilarSlip(slip, { reference: generateReference({ prefix: settings.referencePrefix, existingReferences: persistedReferences(), onPersistenceFailure: recordBackgroundPersistence }), date: today() }); acceptReplacement(next); scrollTo({ top: 0, behavior: 'smooth' }); tell('success', 'A similar slip with a new reference is ready.') }
  const editRecord = (record: PaymentRecord) => { const next = destructiveReplacement('Edit this saved payment? Unsaved changes to the current slip will be lost.', () => copySlip(record.slip)); if (!next) return; acceptReplacement(next, record.id); tell('success', 'Payment record loaded for editing.') }
  const duplicateRecord = (record: PaymentRecord) => { const next = destructiveReplacement('Duplicate this saved payment? Unsaved changes to the current slip will be lost.', () => createSimilarSlip(record.slip, { reference: generateReference({ prefix: settings.referencePrefix, existingReferences: persistedReferences(), onPersistenceFailure: recordBackgroundPersistence }), date: today() })); if (!next) return; acceptReplacement(next); tell('success', 'Duplicate created as a new draft with a new reference.') }
  const deleteRecord = (record: PaymentRecord) => { if (!confirm(`Delete payment record ${record.slip.payment.reference || record.id}? This cannot be undone.`)) return; const next = history.filter(item => item.id !== record.id); const result = saveStoredHistory(localStorage, next); if (!result.success) return tell('error', persistenceMessage(result, 'The payment history')); setHistory(next); if (activeRecordId === record.id) setActiveRecordId(''); tell('success', 'Payment record deleted. The current slip was not changed.') }
  const clearStoredDraft = () => { if (!confirm('Clear the saved draft and recovery snapshot? The currently open slip will remain available until this page closes.')) return; const result = clearDraftData(localStorage); if (!result.success) return tell('error', persistenceMessage(result, 'Draft and recovery data')); tell('success', 'Saved draft and recovery data cleared.') }
  const clearStoredHistory = () => { if (!confirm('Delete all payment history from this browser? The currently open slip will remain unchanged.')) return; const result = clearHistoryData(localStorage); if (!result.success) return tell('error', persistenceMessage(result, 'Payment history')); setHistory([]); setActiveRecordId(''); tell('success', 'Payment history cleared.') }
  const clearStoredRecipients = () => { if (!confirm('Delete all reusable recipients from this browser? Existing payment snapshots will remain unchanged.')) return; const result = clearRecipientData(localStorage); if (!result.success) return tell('error', persistenceMessage(result, 'Saved recipients')); setSavedRecipients([]); setSelectedRecipientId(''); tell('success', 'Saved recipients cleared.') }
  const clearStoredReferences = () => { if (!confirm('Reset locally stored reference counters? Existing slips and history will keep their current references.')) return; const result = clearReferenceData(localStorage, sessionStorage); if (!result.success) return tell('error', persistenceMessage(result, 'Reference data')); tell('success', 'Reference counters and active session reference cleared.') }
  const clearAllStoredData = () => {
    if (!confirm('Clear all Sliply data stored in this browser, including the open slip, profiles, recipients, drafts, history, preferences, and reference counters?')) return
    const result = clearAllSliplyData(localStorage, sessionStorage)
    if (!result.success) { setHistory(loadHistory(localStorage, blank())); setSavedRecipients(loadRecipients(localStorage)); setHasCompanyProfile(loadCompanyProfile(localStorage, blank().company) !== null); return tell('error', persistenceMessage(result, 'Some Sliply data')) }
    setHistory([]); setHistoryQuery(''); setSavedRecipients([]); setHasCompanyProfile(false); setSettings(DEFAULT_SETTINGS); setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches); acceptReplacement(blank(DEFAULT_SETTINGS.defaultCurrency)); tell('success', 'All Sliply data stored in this browser was cleared.')
  }
  const selectStep = (step: WorkflowStep) => { const index = workflowSteps.findIndex(item => item.id === step); if (index <= highestStep) { setActiveStep(step); setAttemptedStep(null); setMobileView('edit'); scrollTo({ top: 0, behavior: 'smooth' }) } }
  const nextStep = () => { const currentErrors = errorsForStep(allErrors, activeStep); if (Object.keys(currentErrors).length) { const first = Object.keys(currentErrors)[0]; setAttemptedStep(activeStep); tell('error', `Please correct the highlighted ${activeStep} field before continuing.`); focusError(first); return } const nextIndex = Math.min(workflowSteps.findIndex(item => item.id === activeStep) + 1, workflowSteps.length - 1); setHighestStep(value => Math.max(value, nextIndex)); setActiveStep(workflowSteps[nextIndex].id); setAttemptedStep(null); setMobileView('edit'); scrollTo({ top: 0, behavior: 'smooth' }) }
  const previousStep = () => { const previousIndex = Math.max(workflowSteps.findIndex(item => item.id === activeStep) - 1, 0); setActiveStep(workflowSteps[previousIndex].id); setAttemptedStep(null); setMobileView('edit'); scrollTo({ top: 0, behavior: 'smooth' }) }
  const showPreview = () => { setMobileView('preview'); requestAnimationFrame(() => preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  const run = async (label: string, task: () => Promise<void>) => { try { setBusy(label); await task() } catch (e) { tell('error', e instanceof Error ? e.message : 'Something went wrong.') } finally { setBusy('') } }
  const documentAction = (action: 'download' | 'print') => runDocumentAction({ action, slip, build: buildPdf, download: downloadPdfDocument, print: printPdfDocument, setBusy, notify: tell, reportError: import.meta.env.DEV ? error => console.error(error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { name: 'Unknown document error' }) : undefined })
  return <div className="app-shell">
    <header className="app-header"><div className="app-brand"><div className="brand-mark"><FilePlus2 /></div><div><strong>Sliply</strong><span>Payment Slip Generator</span></div></div><div className="header-status"><button className="theme-toggle" onClick={toggleDarkMode} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}>{darkMode ? <Sun /> : <Moon />}<span>{darkMode ? 'Light mode' : 'Dark mode'}</span></button><div className="privacy-pill"><ShieldCheck /> Browser-based</div></div></header>
    <main><section className="workspace-intro"><div><span className="eyebrow">DOCUMENT WORKSPACE</span><h1>Create a payment slip</h1><p>Complete four clear steps. Your information stays in place as you move between them.</p></div><div className="header-actions"><button className="button secondary" onClick={loadDraft}><FolderOpen /> Load draft</button><button className="button secondary" onClick={saveDraft}><Save /> Save draft</button><button className="button secondary" onClick={saveRecord}><Save /> {activeRecordId ? 'Update record' : 'Save to history'}</button><button className="button danger-subtle" onClick={clear}><RotateCcw /> Clear</button></div></section>
      <PaymentHistory records={filteredHistory} query={historyQuery} onQuery={setHistoryQuery} onLoad={editRecord} onDuplicate={duplicateRecord} onDelete={deleteRecord} />
      <WorkflowStepper active={activeStep} highestIndex={highestStep} onSelect={selectStep} />
      <div className="mobile-view-switch" role="group" aria-label="Workspace view"><button type="button" className={mobileView === 'edit' ? 'active' : ''} aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>Edit</button><button type="button" className={mobileView === 'preview' ? 'active' : ''} aria-pressed={mobileView === 'preview'} onClick={showPreview}><Eye /> Preview</button></div>
      <div className={`workspace mobile-${mobileView}`}><div className="form-pane">{activeStep === 'review' ? <ReviewPanel slip={slip} errors={allErrors} /> : <SlipForm slip={slip} errors={visibleErrors} step={activeStep} hasCompanyProfile={hasCompanyProfile} savedRecipients={savedRecipients} selectedRecipientId={selectedRecipientId} onChange={setSlip} onSubmit={nextStep} onReference={() => setSlip({ ...slip, payment: { ...slip.payment, reference: generateReference({ prefix: settings.referencePrefix, existingReferences: persistedReferences(), onPersistenceFailure: recordBackgroundPersistence }) } })} onSaveCompany={saveCompany} onClearCompany={clearCompany} onSelectRecipient={selectRecipient} onSaveRecipient={saveRecipient} onDeleteRecipient={deleteRecipient} onLogoError={x => tell('error', x)} />}
        <nav className="workflow-navigation" aria-label="Form step navigation"><button className="button secondary" type="button" onClick={previousStep} disabled={activeStep === 'company'}><ChevronLeft /> Back</button><span>Step {workflowSteps.findIndex(item => item.id === activeStep) + 1} of {workflowSteps.length}</span>{activeStep !== 'review' ? <button className="button primary" type="submit" form="payment-step-form">Continue <ChevronRight /></button> : <button className="button secondary" type="button" onClick={() => selectStep('payment')}><ChevronLeft /> Edit payment</button>}</nav>
        <section className="drive-card" hidden aria-hidden="true"><div className="drive-heading"><div className="drive-icon"><Cloud /></div><div><h2>Google Drive <span>Optional</span></h2><p>{!driveConfigured ? 'Setup required — add a Google OAuth Client ID to enable this feature.' : drive.connected ? 'Connected for this browser session.' : 'Create a Google Doc copy in a folder you choose.'}</p></div><span className={`status ${drive.connected ? 'connected' : ''}`}>{drive.connected ? 'Connected' : 'Not connected'}</span></div>
          {drive.folderName && <div className="folder-display"><HardDrive /> Saving to <strong>{drive.folderName}</strong></div>}
          <div className="inline-actions"><button className="button secondary" disabled={!driveConfigured || !!busy || drive.connected} onClick={() => run('connect', async () => { await connectDrive(); setDrive({ ...drive, connected: true }); tell('success', 'Google Drive connected for this session.') })}>{busy === 'connect' ? <LoaderCircle className="spin" /> : <PlugZap />} Connect Drive</button><button className="button secondary" disabled={!drive.connected || !!busy} onClick={() => run('folder', async () => { const f = await chooseFolder(); setDrive({ ...drive, folderId: f.id, folderName: f.name }) })}><FolderOpen /> Choose folder</button><button className="button secondary" disabled={!drive.connected || !drive.folderId || !valid || !!busy} onClick={() => run('doc', async () => { const doc = await createGoogleDoc(slip, drive.folderId); setDrive({ ...drive, documentUrl: doc.url }); tell('success', 'Google Doc created successfully.') })}>{busy === 'doc' ? <LoaderCircle className="spin" /> : <FilePlus2 />} Create Google Doc</button>{drive.connected && <button className="text-button" onClick={() => { disconnectDrive(); setDrive({ connected: false, folderId: '', folderName: '', documentUrl: '' }) }}><Unplug /> Disconnect</button>}</div>{drive.documentUrl && <a className="doc-link" href={drive.documentUrl} target="_blank" rel="noreferrer">Open created Google Doc ↗</a>}
        </section>{storageWarning && <p className="storage-warning" role="status">{storageWarning}</p>}<SettingsPanel settings={settings} onSave={updateSettings} /><PrivacyControls onClearDraft={clearStoredDraft} onClearHistory={clearStoredHistory} onClearRecipients={clearStoredRecipients} onClearReferences={clearStoredReferences} onClearAll={clearAllStoredData} /><p className="privacy-note"><LockKeyhole /> Stored locally by default. Creating a Google Doc sends the current payment text to Google after you connect.</p><div className="developer-mark">Developed by <a href="https://hsclogic.com/" target="_blank" rel="noreferrer">HSC Logic</a></div></div>
        <aside className="preview-pane" ref={preview}><div className="preview-toolbar"><div><Eye /><span>Live preview</span><i>{slip.payment.paperSize.toUpperCase()} · {slip.payment.orientation === 'portrait' ? 'Portrait' : 'Landscape'}</i></div><div className="total-chip"><span>Total</span><strong>{formatCurrency(total, slip.payment.currency)}</strong></div></div><div className="paper-wrap"><PaymentSlipPreview slip={slip} /></div></aside></div>
    </main>
    {activeStep === 'review' && <div className="action-dock"><div><span>Subtotal</span><strong>{formatCurrency(calculation.subtotal, slip.payment.currency)}</strong></div><button className="button secondary" onClick={showPreview}><Eye /> Preview</button><button className="button secondary" disabled={!valid || !!busy} onClick={() => requireValid(() => void documentAction('print'))}>{busy === 'print' ? <LoaderCircle className="spin" /> : <Printer />} Print</button><button className="button primary" disabled={!valid || !!busy} onClick={() => requireValid(() => void documentAction('download'))}>{busy === 'download' ? <LoaderCircle className="spin" /> : <Download />} Generate PDF</button><button className="button secondary" onClick={similar}><CopyPlus /> Create similar slip</button><button className="button secondary" onClick={another}><FilePlus2 /> New blank slip</button></div>}
    {notice && <div className={`toast ${notice.kind}`} role="status">{notice.kind === 'success' ? <ShieldCheck /> : <span>!</span>}{notice.text}</div>}
  </div>
}
