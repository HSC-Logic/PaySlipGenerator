import { apiFetch, ApiError } from '../../services/api/client'
import type { CurrencyCode, CustomDesign, PaymentRecord, PaymentSlip, SavedRecipient } from '../../types'
import { parseCustomDesign, customDesignKey } from '../../utils/customDesigns'
import { calculatePaymentTotals } from '../../utils/currency'
import { hasUnsavedChanges } from '../../utils/dirtyState'
import { normalizeLogoDataUrl } from '../../utils/logoImage'
import { createBlankSlip } from '../../utils/paymentDefaults'
import { clearCompanyProfile, clearDraftData, clearHistoryData, clearRecipientData, loadCompanyProfile, loadDraft, loadHistory, loadRecipients, loadRecovery, loadSettings, safeGet, safeParse, safeRemove, safeSet, type PersistenceResult } from '../../utils/storage'

/* Browser-to-cloud transfer (docs/backend-design.md section 7, api-contract.md "Phase 3"). */

export type ImportKind = 'design' | 'company' | 'recipient' | 'record' | 'draft'
export type ImportOutcome = 'created' | 'matched' | 'alreadyImported' | 'changedLocally' | 'invalid'

export const FORMAT_VERSION = 1
/** Server caps per request; the body cap is 5 MB, the client fills batches to 4 MB. */
export const BATCH_LIMITS = { logos: 50, designs: 100, recipients: 500, documents: 100, bytes: 4 * 1024 * 1024 } as const
const ENVELOPE_RESERVE = 2048
export const DEVICE_ID_KEY = 'slipy-device-id'
export const DEVICE_LABEL_KEY = 'slipy-device-label'
export const MARKER_PREFIX = 'slipy-cloud-import:'
export const markerKey = (sub: string) => `${MARKER_PREFIX}${sub}`

/* ---------- hashing ---------- */

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('')
const digest = async (bytes: Uint8Array) => toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
const utf8 = (text: string) => new TextEncoder().encode(text)
/** SHA-256 (lower-case hex) of the canonical JSON of a value; keys are sorted so equal content hashes equally. */
export const contentHash = (value: unknown) => digest(utf8(canonical(value)))
const dataUrlBytesOf = (dataUrl: string) => { const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1)); return Uint8Array.from(binary, character => character.charCodeAt(0)) }
/** SHA-256 of the decoded image bytes, which is what the server checks a logo against. */
export const logoHash = (dataUrl: string) => digest(dataUrlBytesOf(dataUrl))
const byteLength = (value: unknown) => utf8(JSON.stringify(value)).length

/* ---------- computer identity ---------- */

export const defaultDeviceLabel = (userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) => {
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /OPR\//.test(userAgent) ? 'Opera' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser'
  const system = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : ''
  return system ? `${browser} on ${system}` : browser
}
export const normalizeDeviceLabel = (label: string) => label.trim().slice(0, 100)

export interface Device { id: string; label: string }

/** The random id is created the first time the transfer runs; the label is editable. */
export const loadDevice = (storage: Storage): Device => {
  let id = safeGet(storage, DEVICE_ID_KEY) ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { id = crypto.randomUUID(); safeSet(storage, DEVICE_ID_KEY, id) }
  const label = normalizeDeviceLabel(safeGet(storage, DEVICE_LABEL_KEY) ?? '') || defaultDeviceLabel()
  return { id, label }
}
export const saveDeviceLabel = (storage: Storage, label: string) => safeSet(storage, DEVICE_LABEL_KEY, normalizeDeviceLabel(label))

/* ---------- per-account marker ---------- */

export interface ImportMarker { version: 1; at: number; deviceId: string; /** `kind:sourceId` to the local content hash that was sent. */ items: Record<string, string> }
export const itemKey = (kind: ImportKind, sourceId: string) => `${kind}:${sourceId}`

export const loadMarker = (storage: Storage, sub: string): ImportMarker | null => {
  const value = safeParse(safeGet(storage, markerKey(sub)))
  if (!value || typeof value !== 'object' || (value as ImportMarker).version !== 1) return null
  const { at, deviceId, items } = value as ImportMarker
  if (typeof at !== 'number' || !items || typeof items !== 'object') return null
  return { version: 1, at, deviceId: typeof deviceId === 'string' ? deviceId : '', items: Object.fromEntries(Object.entries(items).filter(([, hash]) => typeof hash === 'string')) }
}
export const saveMarker = (storage: Storage, sub: string, marker: ImportMarker) => safeSet(storage, markerKey(sub), JSON.stringify(marker))

const storageKeys = (storage: Storage) => { try { return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key)) } catch { return [] } }
/** True when this browser's data was already moved to a different Slipy account and not yet to this one. */
export const movedToOtherAccount = (storage: Storage, sub: string) => !safeGet(storage, markerKey(sub)) && storageKeys(storage).some(key => key.startsWith(MARKER_PREFIX) && key !== markerKey(sub))

/* ---------- reading the browser ---------- */

export interface LocalItem {
  kind: ImportKind
  sourceId: string
  /** Hash of the local content, used for the marker and the "new items" count. */
  hash: string
  /** Human label for the summary lists. */
  label: string
  /** The raw logo data URL used by this item ('' when none). */
  logo: string
  /** Builds the request member; `logo` is the normalised logo's hash. */
  render: (logo: string | undefined) => Record<string, unknown>
}

export interface LocalData {
  items: LocalItem[]
  counts: Record<'company' | 'recipients' | 'records' | 'drafts' | 'designs', number>
}

export const emptyCounts = (): LocalData['counts'] => ({ company: 0, recipients: 0, records: 0, drafts: 0, designs: 0 })

const slipWithLogo = (slip: PaymentSlip, logo: string | undefined) => {
  const { logo: _drop, logoId: _ignored, ...company } = slip.company
  return { ...structuredClone(slip), company: logo ? { ...company, logo: { sha256: logo } } : company }
}
const hasContent = (slip: PaymentSlip) => Boolean(slip.recipient.name.trim() || slip.items.some(item => item.description.trim() || (item.rate !== '' && item.rate !== 0)))
const slipLabel = (slip: PaymentSlip) => slip.payment.reference || slip.recipient.name || 'Untitled document'

const readDesigns = (storage: Storage): CustomDesign[] => {
  const value = safeParse(safeGet(storage, customDesignKey))
  const seen = new Set<string>()
  return Array.isArray(value) ? value.flatMap(entry => { const design = parseCustomDesign(entry); if (!design || seen.has(design.name)) return []; seen.add(design.name); return [design] }) : []
}

export interface ReadOptions {
  /** Drafts and the recovery copy are offered only in the first transfer on each computer. */
  includeDrafts: boolean
}

/** Reads every local key with the existing storage parsers and builds the list of transferable items in server order. */
export async function readBrowserData(storage: Storage, { includeDrafts }: ReadOptions): Promise<LocalData> {
  const defaults = createBlankSlip()
  const items: LocalItem[] = []
  const counts = emptyCounts()

  for (const design of readDesigns(storage)) {
    const sourceId = `design:${design.name}`
    items.push({ kind: 'design', sourceId, hash: await contentHash(design), label: design.name, logo: '', render: () => ({ sourceId, design }) })
    counts.designs++
  }

  const profile = loadCompanyProfile(storage, defaults.company)
  if (profile) {
    const settings = loadSettings(storage)
    const { logo, logoId: _ignored, ...rest } = profile
    items.push({
      kind: 'company', sourceId: 'company-profile', hash: await contentHash({ profile, prefix: settings.referencePrefix, currency: settings.defaultCurrency }), label: profile.name || 'Company profile', logo,
      render: sha => ({ sourceId: 'company-profile', company: sha ? { ...rest, logo: { sha256: sha } } : rest, referencePrefix: settings.referencePrefix, defaultCurrency: settings.defaultCurrency as CurrencyCode }),
    })
    counts.company++
  }

  for (const recipient of loadRecipients(storage)) {
    const { id, ...fields } = recipient satisfies SavedRecipient
    items.push({ kind: 'recipient', sourceId: id, hash: await contentHash(recipient), label: recipient.name, logo: '', render: () => ({ sourceId: id, recipient: { ...fields, identification: '' } }) })
    counts.recipients++
  }

  for (const record of loadHistory(storage, defaults)) {
    const totals = calculatePaymentTotals(record.slip.items, record.slip.payment.adjustment, record.slip.adjustments)
    items.push({
      kind: 'record', sourceId: record.id, hash: await contentHash(record.slip), label: slipLabel(record.slip), logo: record.slip.company.logo,
      render: sha => ({ sourceId: record.id, ...(record.createdAt ? { createdAt: record.createdAt } : {}), ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}), slip: slipWithLogo(record.slip, sha), storedTotals: { subtotal: totals.subtotal, finalTotal: totals.final }, asCopy: false }),
    })
    counts.records++
  }

  if (includeDrafts) {
    const candidates: PaymentSlip[] = []
    const draft = loadDraft(storage, defaults)
    if (draft && hasContent(draft)) candidates.push(draft)
    const recovery = loadRecovery(storage, defaults)
    if (recovery && hasUnsavedChanges(recovery.slip, recovery.baseline) && hasContent(recovery.slip)) candidates.push(recovery.slip)
    const seen = new Set<string>()
    for (const slip of candidates) {
      const hash = await contentHash(slip)
      const sourceId = `draft:${hash}`
      if (seen.has(sourceId)) continue
      seen.add(sourceId)
      items.push({ kind: 'draft', sourceId, hash, label: slipLabel(slip), logo: slip.company.logo, render: sha => ({ sourceId, slip: slipWithLogo(slip, sha) }) })
      counts.drafts++
    }
  }
  return { items, counts }
}

export const totalItems = (counts: LocalData['counts']) => counts.company + counts.recipients + counts.records + counts.drafts + counts.designs

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
export const describeCounts = (counts: LocalData['counts']) => [
  counts.company && plural(counts.company, 'company', 'companies'), counts.recipients && plural(counts.recipients, 'recipient'), counts.records && plural(counts.records, 'document'),
  counts.drafts && plural(counts.drafts, 'draft'), counts.designs && plural(counts.designs, 'design'),
].filter(Boolean).join(', ')

/** History records and recipients that are new or changed since the last transfer. Records saved under Pro never count (section 7). */
export async function countNewItems(storage: Storage, marker: ImportMarker | null): Promise<number> {
  const defaults = createBlankSlip()
  let count = 0
  for (const record of loadHistory(storage, defaults)) {
    if (record.savedUnderPlan === 'pro') continue
    if (marker?.items[itemKey('record', record.id)] !== await contentHash(record.slip)) count++
  }
  for (const recipient of loadRecipients(storage)) if (marker?.items[itemKey('recipient', recipient.id)] !== await contentHash(recipient)) count++
  return count
}

/** Plan stamp for new browser records (backward compatible: older records have none and count as not yet in the cloud). */
export const stampPlan = (record: PaymentRecord, plan: 'free' | 'pro'): PaymentRecord => ({ ...record, savedUnderPlan: plan })

/* ---------- request and response shapes ---------- */

export interface ImportRequest {
  formatVersion: 1
  device: Device
  logos?: { sha256: string; data: string }[]
  designs?: Record<string, unknown>[]
  companyProfile?: Record<string, unknown>
  recipients?: Record<string, unknown>[]
  records?: Record<string, unknown>[]
  drafts?: Record<string, unknown>[]
}
export interface ItemWarning { code: string; message: string }
export interface ImportItemResult {
  kind: ImportKind; sourceId: string; outcome: ImportOutcome; targetId?: string; reference?: string; referenceConflict?: boolean; totalsDiffer?: boolean
  reason?: string; errors?: Record<string, string[]>; renamedTo?: string; warnings?: ItemWarning[]
}
export interface TotalsPair { subtotal?: number; finalTotal?: number }
export interface ImportResponse {
  formatVersion: number
  device?: { id: string; label: string; firstImportAt?: string; lastImportAt?: string }
  items: ImportItemResult[]
  summary?: {
    referenceConflicts?: { reference: string; count: number; targetIds?: string[] }[]
    totalsDifferences?: { kind: ImportKind; sourceId: string; targetId?: string; reference?: string; stored?: TotalsPair; recalculated?: TotalsPair }[]
    merged?: { kind: ImportKind; name: string; targetId: string; targetName?: string; sourceIds?: string[] }[]
    warnings?: ItemWarning[]
  }
}
export interface TransferredComputer { id: string; label: string; firstImportAt?: string; lastImportAt?: string; counts: Partial<Record<ImportKind, number>> }

export type PostBatch = (body: ImportRequest) => Promise<ImportResponse>
export const postBatch: PostBatch = body => apiFetch<ImportResponse>('/imports/browser', { method: 'POST', body: JSON.stringify(body) })
export const listTransferredComputers = async () => (await apiFetch<{ devices?: TransferredComputer[] }>('/imports/browser')).devices ?? []

/* ---------- planning ---------- */

export interface LocalInvalid { kind: ImportKind; sourceId: string; label: string; reason: string }
export interface PlannedBatch { body: ImportRequest; keys: string[] }
export interface TransferPlan {
  device: Device
  batches: PlannedBatch[]
  /** Items that cannot be sent at all; they stay in the browser. */
  localInvalid: LocalInvalid[]
  items: Map<string, LocalItem>
  /** Normalised logo data by hash, kept to resend a logo with an "import as a copy" batch. */
  logoData: Map<string, string>
  /** The logo hash used by each item, by item key. */
  itemLogo: Map<string, string>
  logoWarnings: { key: string; label: string; message: string }[]
}

export interface PlanOptions { normalizeLogo?: (dataUrl: string) => Promise<string> }

const emptyBatch = () => ({ logos: new Map<string, string>(), designs: [] as Record<string, unknown>[], company: undefined as Record<string, unknown> | undefined, recipients: [] as Record<string, unknown>[], records: [] as Record<string, unknown>[], drafts: [] as Record<string, unknown>[], keys: [] as string[], bytes: ENVELOPE_RESERVE })
type Draft = ReturnType<typeof emptyBatch>

const finalize = (device: Device, batch: Draft): PlannedBatch => ({
  keys: batch.keys,
  body: {
    formatVersion: FORMAT_VERSION, device,
    ...(batch.logos.size ? { logos: [...batch.logos].map(([sha256, data]) => ({ sha256, data })) } : {}),
    ...(batch.designs.length ? { designs: batch.designs } : {}), ...(batch.company ? { companyProfile: batch.company } : {}),
    ...(batch.recipients.length ? { recipients: batch.recipients } : {}), ...(batch.records.length ? { records: batch.records } : {}), ...(batch.drafts.length ? { drafts: batch.drafts } : {}),
  },
})

/**
 * Normalises and de-duplicates logos, then fills batches by size (4 MB) within the per-list caps.
 * Logos travel once, in the first batch that uses them. Order: designs, company, recipients, records, drafts.
 */
export async function planTransfer(data: LocalData, device: Device, { normalizeLogo = normalizeLogoDataUrl }: PlanOptions = {}): Promise<TransferPlan> {
  const logoByRaw = new Map<string, { sha: string; data: string } | { error: string }>()
  const logoData = new Map<string, string>()
  for (const raw of new Set(data.items.map(item => item.logo).filter(Boolean))) {
    try { const normalised = await normalizeLogo(raw); const sha = await logoHash(normalised); logoByRaw.set(raw, { sha, data: normalised }); logoData.set(sha, normalised) }
    catch (error) { logoByRaw.set(raw, { error: error instanceof Error ? error.message : 'The logo could not be processed.' }) }
  }

  const items = new Map<string, LocalItem>(), itemLogo = new Map<string, string>()
  const localInvalid: LocalInvalid[] = [], logoWarnings: TransferPlan['logoWarnings'] = [], batches: PlannedBatch[] = []
  const sent = new Set<string>()
  let current = emptyBatch()
  const flush = () => { if (!current.keys.length) return; batches.push(finalize(device, current)); current.logos.forEach((_, sha) => sent.add(sha)); current = emptyBatch() }

  for (const item of data.items) {
    const key = itemKey(item.kind, item.sourceId)
    items.set(key, item)
    const logo = item.logo ? logoByRaw.get(item.logo) : undefined
    const sha = logo && 'sha' in logo ? logo.sha : undefined
    if (logo && 'error' in logo) logoWarnings.push({ key, label: item.label, message: `The logo of "${item.label}" was left out: ${logo.error}` })
    if (sha) itemLogo.set(key, sha)
    const entry = item.render(sha)
    const entryBytes = byteLength(entry) + 1
    const logoPayload = sha ? byteLength({ sha256: sha, data: logoData.get(sha) }) + 1 : 0
    if (entryBytes + (sha && !sent.has(sha) ? logoPayload : 0) + ENVELOPE_RESERVE > BATCH_LIMITS.bytes) { localInvalid.push({ kind: item.kind, sourceId: item.sourceId, label: item.label, reason: 'too large' }); continue }
    const addsLogo = () => Boolean(sha && !sent.has(sha) && !current.logos.has(sha))
    const fits = () => current.bytes + entryBytes + (addsLogo() ? logoPayload : 0) <= BATCH_LIMITS.bytes
      && (!addsLogo() || current.logos.size < BATCH_LIMITS.logos)
      && (item.kind !== 'design' || current.designs.length < BATCH_LIMITS.designs)
      && (item.kind !== 'recipient' || current.recipients.length < BATCH_LIMITS.recipients)
      && ((item.kind !== 'record' && item.kind !== 'draft') || current.records.length + current.drafts.length < BATCH_LIMITS.documents)
    if (!fits()) flush()
    if (sha && addsLogo()) { current.logos.set(sha, logoData.get(sha) as string); current.bytes += logoPayload }
    current.bytes += entryBytes
    current.keys.push(key)
    if (item.kind === 'design') current.designs.push(entry)
    else if (item.kind === 'company') current.company = entry
    else if (item.kind === 'recipient') current.recipients.push(entry)
    else if (item.kind === 'record') current.records.push(entry)
    else current.drafts.push(entry)
  }
  flush()
  return { device, batches, localInvalid, items, logoData, itemLogo, logoWarnings }
}

/** A batch that re-sends changed records with `asCopy: true` (including their logos, so a copy never loses the letterhead). */
export function planCopyBatch(plan: TransferPlan, sourceIds: string[]): PlannedBatch | null {
  const keys = sourceIds.map(id => itemKey('record', id)).filter(key => plan.items.has(key))
  if (!keys.length) return null
  const logos = new Map<string, string>(), records: Record<string, unknown>[] = []
  for (const key of keys) {
    const sha = plan.itemLogo.get(key)
    if (sha) logos.set(sha, plan.logoData.get(sha) as string)
    records.push({ ...(plan.items.get(key) as LocalItem).render(sha), asCopy: true })
  }
  return { keys, body: { formatVersion: FORMAT_VERSION, device: plan.device, ...(logos.size ? { logos: [...logos].map(([sha256, data]) => ({ sha256, data })) } : {}), records } }
}

/* ---------- running ---------- */

export type BatchState = { status: 'pending' } | { status: 'sent' } | { status: 'failed'; message: string }
export interface TransferProgress {
  batches: BatchState[]
  /** Latest result per `kind:sourceId`. */
  results: Record<string, ImportItemResult>
  merged: NonNullable<NonNullable<ImportResponse['summary']>['merged']>
  referenceConflicts: Record<string, { reference: string; count: number; targetIds: string[] }>
  totalsDifferences: NonNullable<NonNullable<ImportResponse['summary']>['totalsDifferences']>
  warnings: ItemWarning[]
}

export const initialProgress = (plan: TransferPlan): TransferProgress => ({ batches: plan.batches.map(() => ({ status: 'pending' as const })), results: {}, merged: [], referenceConflicts: {}, totalsDifferences: [], warnings: [] })

const mergeUnique = <T,>(existing: T[], added: T[] | undefined, keyOf: (value: T) => string) => { const map = new Map(existing.map(value => [keyOf(value), value])); added?.forEach(value => map.set(keyOf(value), value)); return [...map.values()] }

/** Pure: folds one batch response into the progress. Re-sent items replace their earlier result. */
export function applyResponse(progress: TransferProgress, response: ImportResponse): TransferProgress {
  const results = { ...progress.results }
  for (const item of response.items ?? []) results[itemKey(item.kind, item.sourceId)] = item
  const referenceConflicts = { ...progress.referenceConflicts }
  for (const conflict of response.summary?.referenceConflicts ?? []) referenceConflicts[conflict.reference] = { reference: conflict.reference, count: conflict.count, targetIds: mergeUnique(referenceConflicts[conflict.reference]?.targetIds ?? [], conflict.targetIds, id => id) }
  return {
    ...progress, results, referenceConflicts,
    merged: mergeUnique(progress.merged, response.summary?.merged, merge => `${merge.kind}:${merge.targetId}:${merge.sourceIds?.join(',') ?? merge.name}`),
    totalsDifferences: mergeUnique(progress.totalsDifferences, response.summary?.totalsDifferences, difference => `${difference.kind}:${difference.sourceId}`),
    warnings: mergeUnique(progress.warnings, response.summary?.warnings, warning => `${warning.code}:${warning.message}`),
  }
}

export const failedBatchIndex = (progress: TransferProgress) => progress.batches.findIndex(batch => batch.status === 'failed')
export const isComplete = (progress: TransferProgress) => progress.batches.every(batch => batch.status === 'sent')

export interface RunOptions {
  post?: PostBatch
  /** Called after every batch with the updated progress. */
  onProgress?: (progress: TransferProgress) => void
  /** Called after a batch succeeds so the caller can update the marker. */
  onBatchSent?: (batch: PlannedBatch, response: ImportResponse) => void
  sleep?: (milliseconds: number) => Promise<void>
  signal?: AbortSignal
}

const MAX_AUTO_WAIT_SECONDS = 15
const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds))
export const failureMessage = (error: unknown) => error instanceof ApiError ? (error.kind === 'payload-too-large' || error.status === 413 ? 'The batch was larger than the server accepts.' : error.status === 429 ? `Too many transfers in the last hour. Wait${error.retryAfterSeconds ? ` about ${Math.ceil(error.retryAfterSeconds / 60)} minute(s)` : ''} and retry.` : error.message)
  : error instanceof Error ? error.message : 'The transfer failed.'

/**
 * Sends the batches in order, starting at the first one not yet sent. Stops at the first failure (later batches may rely on
 * logos sent earlier) and records it; calling again resumes there, which is safe because the server de-duplicates by (device, kind, sourceId).
 * A 503/429 with a short Retry-After is retried once automatically.
 */
export async function runTransfer(plan: TransferPlan, start: TransferProgress, { post = postBatch, onProgress, onBatchSent, sleep = wait, signal }: RunOptions = {}): Promise<TransferProgress> {
  let progress = start
  for (let index = 0; index < plan.batches.length; index++) {
    if (progress.batches[index].status === 'sent') continue
    if (signal?.aborted) break
    const batch = plan.batches[index]
    let response: ImportResponse | undefined, failure: unknown
    for (let attempt = 0; attempt < 2 && !response; attempt++) {
      try { response = await post(batch.body) } catch (error) {
        failure = error
        const retryable = error instanceof ApiError && (error.status === 503 || error.status === 429) && error.retryAfterSeconds !== undefined && error.retryAfterSeconds <= MAX_AUTO_WAIT_SECONDS
        if (!retryable) break
        await sleep(error.retryAfterSeconds! * 1000)
      }
    }
    if (!response) {
      progress = { ...progress, batches: progress.batches.map((state, position) => position === index ? { status: 'failed', message: failureMessage(failure) } : state) }
      onProgress?.(progress)
      return progress
    }
    progress = applyResponse({ ...progress, batches: progress.batches.map((state, position) => position === index ? { status: 'sent' } : state) }, response)
    onBatchSent?.(batch, response)
    onProgress?.(progress)
  }
  return progress
}

/** Sends the changed records again as separate documents. */
export async function runCopyBatch(plan: TransferPlan, progress: TransferProgress, sourceIds: string[], options: Pick<RunOptions, 'post' | 'onBatchSent'> = {}): Promise<TransferProgress> {
  const batch = planCopyBatch(plan, sourceIds)
  if (!batch) return progress
  const response = await (options.post ?? postBatch)(batch.body)
  options.onBatchSent?.(batch, response)
  return applyResponse(progress, response)
}

/* ---------- marker bookkeeping ---------- */

const accepted: ImportOutcome[] = ['created', 'matched', 'alreadyImported']
/** Records the hash of every item the server has (created, matched or already imported) in the account's marker. */
export function updateMarker(marker: ImportMarker | null, plan: TransferPlan, response: ImportResponse, now = Date.now()): ImportMarker {
  const items = { ...marker?.items }
  for (const result of response.items ?? []) {
    const key = itemKey(result.kind, result.sourceId)
    const local = plan.items.get(key)
    if (local && accepted.includes(result.outcome)) items[key] = local.hash
  }
  return { version: 1, at: now, deviceId: plan.device.id, items }
}

/* ---------- summaries ---------- */

export type KindSummary = Record<ImportOutcome | 'tooLarge', number>
export const emptyKindSummary = (): KindSummary => ({ created: 0, matched: 0, alreadyImported: 0, changedLocally: 0, invalid: 0, tooLarge: 0 })
export const summarize = (plan: TransferPlan, progress: TransferProgress): Record<ImportKind, KindSummary> => {
  const kinds: ImportKind[] = ['company', 'recipient', 'record', 'draft', 'design']
  const summary = Object.fromEntries(kinds.map(kind => [kind, emptyKindSummary()])) as Record<ImportKind, KindSummary>
  for (const result of Object.values(progress.results)) summary[result.kind][result.outcome]++
  for (const invalid of plan.localInvalid) summary[invalid.kind].tooLarge++
  return summary
}
export const itemsWithOutcome = (progress: TransferProgress, outcome: ImportOutcome) => Object.values(progress.results).filter(result => result.outcome === outcome)
/** Items the server has not imported and that therefore stay only in this browser. */
export const notMovedCount = (plan: TransferPlan, progress: TransferProgress) => itemsWithOutcome(progress, 'invalid').length + itemsWithOutcome(progress, 'changedLocally').length + plan.localInvalid.length

/* ---------- removing the browser copy ---------- */

/** Removes the transferred browser data (company, recipients, history, draft and recovery, designs). Theme, settings and reference counters stay. */
export function removeBrowserCopy(storage: Storage): PersistenceResult {
  for (const step of [clearCompanyProfile, clearRecipientData, clearHistoryData, clearDraftData, (target: Storage) => safeRemove(target, customDesignKey)]) {
    const result = step(storage)
    if (!result.success) return result
  }
  return { success: true }
}
