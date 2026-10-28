import { describe, expect, it, vi } from 'vitest'
import { createBasicSlip } from '../../test/fixtures/paymentSlips'
import type { PaymentRecord, PaymentSlip } from '../../types'
import { saveCompany, saveDraft, saveHistory, saveRecipients, saveSettings, saveRecovery } from '../../utils/storage'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1')
vi.mock('../../services/cognito/auth', () => ({ getAccessContext: async () => ({ token: 'tok', pro: true, lapsed: false }) }))
const m = await import('./browserImport')
const { ApiError } = await import('../../services/api/client')

const memory = () => { const values = new Map<string, string>(); return { get length() { return values.size }, clear: () => values.clear(), getItem: (k: string) => values.get(k) ?? null, key: (i: number) => [...values.keys()][i] ?? null, removeItem: (k: string) => { values.delete(k) }, setItem: (k: string, v: string) => { values.set(k, v) } } as Storage }
const LOGO = 'data:image/png;base64,QUJD'
const slipWith = (n: number, extra: Partial<PaymentSlip['company']> = {}, notes = ''): PaymentSlip => { const slip = createBasicSlip(); slip.payment.reference = `PS-2026-${String(n).padStart(4, '0')}`; slip.payment.notes = notes; slip.company = { ...slip.company, ...extra }; return slip }
const record = (n: number, extra?: Partial<PaymentSlip['company']>, notes?: string, plan?: 'free' | 'pro'): PaymentRecord => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, createdAt: 1_700_000_000_000 + n, updatedAt: 1_700_000_000_000 + n, slip: slipWith(n, extra, notes), ...(plan ? { savedUnderPlan: plan } : {}) })
const device = { id: '11111111-1111-4111-8111-111111111111', label: 'Office laptop' }
const identity = async (value: string) => value
const created = (body: import('./browserImport').ImportRequest): import('./browserImport').ImportResponse => ({
  formatVersion: 1,
  items: [
    ...(body.designs ?? []).map(x => ({ kind: 'design' as const, sourceId: String(x.sourceId), outcome: 'created' as const })),
    ...(body.companyProfile ? [{ kind: 'company' as const, sourceId: 'company-profile', outcome: 'created' as const }] : []),
    ...(body.recipients ?? []).map(x => ({ kind: 'recipient' as const, sourceId: String(x.sourceId), outcome: 'created' as const })),
    ...(body.records ?? []).map(x => ({ kind: 'record' as const, sourceId: String(x.sourceId), outcome: 'created' as const })),
    ...(body.drafts ?? []).map(x => ({ kind: 'draft' as const, sourceId: String(x.sourceId), outcome: 'created' as const })),
  ],
})

describe('hashing and identity', () => {
  it('hashes equal content equally regardless of key order', async () => {
    expect(await m.contentHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(await m.contentHash({ b: [1, { d: 3, c: 2 }], a: 1 }))
    expect(await m.contentHash({ a: 1 })).not.toBe(await m.contentHash({ a: 2 }))
    expect(await m.contentHash('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
  it('hashes the decoded logo bytes (sha256 of "ABC")', async () => { expect(await m.logoHash(LOGO)).toBe('b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78') })
  it('creates a device id once and keeps the label editable', () => {
    const s = memory(); const first = m.loadDevice(s); expect(first.id).toMatch(/^[0-9a-f-]{36}$/); expect(m.loadDevice(s).id).toBe(first.id)
    m.saveDeviceLabel(s, '  Home PC  '); expect(m.loadDevice(s).label).toBe('Home PC')
    expect(m.defaultDeviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537')).toBe('Chrome on Windows')
  })
  it('detects data already moved to another account', () => {
    const s = memory(); expect(m.movedToOtherAccount(s, 'a')).toBe(false)
    m.saveMarker(s, 'a', { version: 1, at: 1, deviceId: 'd', items: {} })
    expect(m.movedToOtherAccount(s, 'a')).toBe(false); expect(m.movedToOtherAccount(s, 'b')).toBe(true)
    m.saveMarker(s, 'b', { version: 1, at: 1, deviceId: 'd', items: {} }); expect(m.movedToOtherAccount(s, 'b')).toBe(false)
  })
})

describe('readBrowserData', () => {
  const seed = () => {
    const s = memory(); const slip = slipWith(1, { logo: LOGO })
    saveCompany(s, slip.company); saveSettings(s, { theme: 'dark', defaultCurrency: 'USD', referencePrefix: 'INV' })
    saveRecipients(s, [{ id: 'r1', name: 'Nimal', role: 'Tutor', address: '', email: '', telephone: '' }])
    saveHistory(s, [record(1, { logo: LOGO }, '', 'free')]); saveDraft(s, slipWith(7))
    const recovered = slipWith(8); recovered.recipient.name = 'Someone'; saveRecovery(s, recovered, slipWith(8))
    s.setItem('payment-slip-custom-designs', JSON.stringify([{ name: 'Ocean', layout: 'modern', color: '#0b1f3a', font: 'helvetica' }, { name: '', layout: 'x' }]))
    return s
  }
  it('reads every key with the storage parsers and assigns sourceIds (saved draft and recovery copy are separate drafts)', async () => {
    const data = await m.readBrowserData(seed(), { includeDrafts: true })
    expect(data.counts).toEqual({ company: 1, recipients: 1, records: 1, drafts: 2, designs: 1 })
    expect(data.items.map(i => `${i.kind}:${i.sourceId.replace(/[0-9a-f]{64}/, '<hash>')}`)).toEqual(['design:design:Ocean', 'company:company-profile', 'recipient:r1', `record:${record(1).id}`, 'draft:draft:<hash>', 'draft:draft:<hash>'])
    const company = data.items.find(i => i.kind === 'company')!.render('abc') as { company: { logo: unknown }; referencePrefix: string; defaultCurrency: string }
    expect(company).toMatchObject({ referencePrefix: 'INV', defaultCurrency: 'USD', company: { logo: { sha256: 'abc' } } })
    const rec = data.items.find(i => i.kind === 'record')!.render(undefined) as { slip: { company: Record<string, unknown> }; storedTotals: unknown; createdAt: number; asCopy: boolean }
    expect(rec.slip.company).not.toHaveProperty('logo'); expect(rec.storedTotals).toEqual({ subtotal: expect.any(Number), finalTotal: expect.any(Number) }); expect(rec.createdAt).toBe(1_700_000_000_001); expect(rec.asCopy).toBe(false)
  })
  it('skips drafts and recovery after the first transfer', async () => { expect((await m.readBrowserData(seed(), { includeDrafts: false })).counts.drafts).toBe(0) })
  it('returns nothing for an empty browser', async () => { expect(m.totalItems((await m.readBrowserData(memory(), { includeDrafts: true })).counts)).toBe(0) })
})

describe('planTransfer', () => {
  const dataOf = async (records: PaymentRecord[], recipients = 0) => { const s = memory(); saveHistory(s, records); saveRecipients(s, Array.from({ length: recipients }, (_, i) => ({ id: `r${i}`, name: `R${i}`, role: 'x', address: '', email: '', telephone: '' }))); return m.readBrowserData(s, { includeDrafts: false }) }
  it('sends a shared logo once, in the first batch that uses it, and refers to it by hash afterwards', async () => {
    const plan = await m.planTransfer(await dataOf(Array.from({ length: 250 }, (_, i) => record(i + 1, { logo: LOGO }))), device, { normalizeLogo: identity })
    expect(plan.batches).toHaveLength(3)
    expect(plan.batches.map(b => b.body.records?.length)).toEqual([100, 100, 50])
    expect(plan.batches[0].body.logos).toHaveLength(1); expect(plan.batches[1].body.logos).toBeUndefined(); expect(plan.batches[2].body.logos).toBeUndefined()
    const sha = plan.batches[0].body.logos![0].sha256
    expect((plan.batches[2].body.records![0] as { slip: { company: { logo: unknown } } }).slip.company.logo).toEqual({ sha256: sha })
  })
  it('splits by size within 4 MB and reports a record that cannot fit', async () => {
    const big = 'x'.repeat(1_500_000)
    const plan = await m.planTransfer(await dataOf([record(1, {}, big), record(2, {}, big), record(3, {}, big), record(4, {}, big), record(5, {}, 'y'.repeat(4_500_000))]), device, { normalizeLogo: identity })
    expect(plan.localInvalid).toEqual([expect.objectContaining({ kind: 'record', reason: 'too large' })])
    expect(plan.batches.map(b => b.body.records?.length)).toEqual([2, 2])
    for (const batch of plan.batches) expect(new TextEncoder().encode(JSON.stringify(batch.body)).length).toBeLessThanOrEqual(m.BATCH_LIMITS.bytes)
  })
  it('caps recipients at 500 and keeps order designs, company, recipients, records', async () => {
    const plan = await m.planTransfer(await dataOf([record(1)], 600), device, { normalizeLogo: identity })
    expect(plan.batches.map(b => b.body.recipients?.length ?? 0)).toEqual([500, 100])
    expect(plan.batches[1].body.records).toHaveLength(1)
  })
  it('caps distinct logos at 50 per batch', async () => {
    const records = Array.from({ length: 60 }, (_, i) => record(i + 1, { logo: `data:image/png;base64,${btoa(`logo-${i}`)}` }))
    const plan = await m.planTransfer(await dataOf(records), device, { normalizeLogo: identity })
    expect(plan.batches.map(b => b.body.logos?.length)).toEqual([50, 10])
  })
  it('imports without the logo and warns when it cannot be normalised', async () => {
    const plan = await m.planTransfer(await dataOf([record(1, { logo: LOGO })]), device, { normalizeLogo: async () => { throw new Error('too detailed') } })
    expect(plan.logoWarnings[0].message).toContain('too detailed'); expect(plan.batches[0].body.logos).toBeUndefined()
    expect((plan.batches[0].body.records![0] as { slip: { company: Record<string, unknown> } }).slip.company).not.toHaveProperty('logo')
  })
})

describe('runTransfer', () => {
  const planOf = async (count: number) => { const s = memory(); saveHistory(s, Array.from({ length: count }, (_, i) => record(i + 1))); return m.planTransfer(await m.readBrowserData(s, { includeDrafts: false }), device, { normalizeLogo: identity }) }
  it('sends batches in order, folds the summary and updates the marker', async () => {
    const plan = await planOf(150); const post = vi.fn(async (b: import('./browserImport').ImportRequest) => ({ ...created(b), summary: { referenceConflicts: [{ reference: 'PS-2026-0001', count: 2, targetIds: ['a'] }], totalsDifferences: [{ kind: 'record' as const, sourceId: 's', reference: 'PS-2026-0001', stored: { finalTotal: 1 }, recalculated: { finalTotal: 2 } }], merged: [{ kind: 'recipient' as const, name: 'N', targetId: 't', sourceIds: ['x'] }] } }))
    let marker: import('./browserImport').ImportMarker | null = null
    const progress = await m.runTransfer(plan, m.initialProgress(plan), { post, onBatchSent: (_b, r) => { marker = m.updateMarker(marker, plan, r, 5) } })
    expect(post).toHaveBeenCalledTimes(2); expect(m.isComplete(progress)).toBe(true)
    expect(m.summarize(plan, progress).record.created).toBe(150)
    expect(Object.keys(progress.referenceConflicts)).toEqual(['PS-2026-0001']); expect(progress.totalsDifferences).toHaveLength(1); expect(progress.merged).toHaveLength(1)
    expect(Object.keys(marker!.items)).toHaveLength(150)
  })
  it('replays idempotently: alreadyImported results replace earlier ones and nothing is created', async () => {
    const plan = await planOf(3); const first = await m.runTransfer(plan, m.initialProgress(plan), { post: async b => created(b) })
    const replay = await m.runTransfer(plan, m.initialProgress(plan), { post: async b => ({ formatVersion: 1, items: created(b).items.map(i => ({ ...i, outcome: 'alreadyImported' as const })) }) })
    expect(m.summarize(plan, first).record.created).toBe(3); expect(m.summarize(plan, replay).record).toMatchObject({ created: 0, alreadyImported: 3 })
  })
  it('stops at the first failed batch and a retry resumes there without resending earlier batches', async () => {
    const plan = await planOf(250); let calls = 0
    const post = vi.fn(async (b: import('./browserImport').ImportRequest) => { calls++; if (calls === 2) throw new ApiError('boom', 500, 'unknown'); return created(b) })
    const stopped = await m.runTransfer(plan, m.initialProgress(plan), { post })
    expect(m.failedBatchIndex(stopped)).toBe(1); expect(stopped.batches[2].status).toBe('pending'); expect(post).toHaveBeenCalledTimes(2)
    const resumed = await m.runTransfer(plan, stopped, { post })
    expect(post).toHaveBeenCalledTimes(4); expect(m.isComplete(resumed)).toBe(true); expect(m.summarize(plan, resumed).record.created).toBe(250)
  })
  it('retries once after a short 503 Retry-After, and gives up on a long wait', async () => {
    const plan = await planOf(1); const sleep = vi.fn(async () => undefined); let calls = 0
    const ok = await m.runTransfer(plan, m.initialProgress(plan), { sleep, post: async b => { if (calls++ === 0) throw new ApiError('busy', 503, 'temporarily-unavailable', 3); return created(b) } })
    expect(sleep).toHaveBeenCalledWith(3000); expect(m.isComplete(ok)).toBe(true)
    const slow = await m.runTransfer(plan, m.initialProgress(plan), { sleep, post: async () => { throw new ApiError('limit', 429, 'rate-limited', 1800) } })
    expect(slow.batches[0]).toMatchObject({ status: 'failed', message: expect.stringContaining('Too many transfers') })
  })
  it('resends changedLocally records as a copy', async () => {
    const plan = await planOf(1); const id = record(1).id
    const progress = await m.runTransfer(plan, m.initialProgress(plan), { post: async () => ({ formatVersion: 1, items: [{ kind: 'record', sourceId: id, outcome: 'changedLocally' }] }) })
    expect(m.itemsWithOutcome(progress, 'changedLocally')).toHaveLength(1)
    const post = vi.fn(async (b: import('./browserImport').ImportRequest) => created(b))
    const after = await m.runCopyBatch(plan, progress, [id], { post })
    expect((post.mock.calls[0][0].records![0] as { asCopy: boolean }).asCopy).toBe(true); expect(m.summarize(plan, after).record).toMatchObject({ created: 1, changedLocally: 0 })
  })
  it('does not record rejected or changed items in the marker', async () => {
    const plan = await planOf(2); const [a, b] = [record(1).id, record(2).id]
    const marker = m.updateMarker(null, plan, { formatVersion: 1, items: [{ kind: 'record', sourceId: a, outcome: 'matched' }, { kind: 'record', sourceId: b, outcome: 'invalid', reason: 'x' }] })
    expect(Object.keys(marker.items)).toEqual([m.itemKey('record', a)])
  })
})

describe('new items on this computer', () => {
  it('counts unsent and edited items; records saved under Pro never count; records without a marker count', async () => {
    const s = memory(); const sent = record(1, {}, '', 'free'); saveHistory(s, [sent, record(2), record(3, {}, '', 'free'), record(4, {}, '', 'pro')])
    saveRecipients(s, [{ id: 'r1', name: 'A', role: '', address: '', email: '', telephone: '' }])
    const edited = { ...record(3, {}, '', 'free'), slip: slipWith(3, {}, 'edited') }; saveHistory(s, [sent, record(2), edited, record(4, {}, '', 'pro')])
    const marker: import('./browserImport').ImportMarker = { version: 1, at: 1, deviceId: 'd', items: { [m.itemKey('record', sent.id)]: await m.contentHash(sent.slip), [m.itemKey('record', edited.id)]: await m.contentHash(record(3).slip) } }
    expect(await m.countNewItems(s, marker)).toBe(3) // record 2 (legacy, unsent), record 3 (edited), recipient r1
    expect(await m.countNewItems(s, null)).toBe(4) // all except the Pro one
  })
  it('stamps the plan on a record and loadHistory keeps it', async () => {
    const s = memory(); saveHistory(s, [m.stampPlan(record(1), 'free'), record(2)])
    const { loadHistory } = await import('../../utils/storage')
    expect(loadHistory(s, slipWith(0)).map(r => r.savedUnderPlan)).toEqual(['free', undefined])
  })
})

describe('removeBrowserCopy', () => {
  it('removes transferred data but keeps settings', () => {
    const s = memory(); saveHistory(s, [record(1)]); saveRecipients(s, []); saveDraft(s, slipWith(1)); saveSettings(s, { theme: 'dark', defaultCurrency: 'LKR', referencePrefix: 'PS' }); s.setItem('payment-slip-custom-designs', '[]'); saveCompany(s, slipWith(1).company)
    expect(m.removeBrowserCopy(s)).toEqual({ success: true })
    expect([...Array(s.length).keys()].map(i => s.key(i))).toEqual(['payment-slip-settings'])
  })
})

describe('postBatch over fetch', () => {
  it('posts JSON with the bearer token and maps 413 and 429', async () => {
    const fetchMock = vi.fn(async () => Response.json({ formatVersion: 1, items: [] })); vi.stubGlobal('fetch', fetchMock)
    await m.postBatch({ formatVersion: 1, device })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/api/v1/imports/browser'); expect(init.method).toBe('POST'); expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok'); expect(JSON.parse(String(init.body))).toMatchObject({ formatVersion: 1, device })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'https://slipy.hsclogic.link/problems/payload-too-large' }), { status: 413 })))
    await expect(m.postBatch({ formatVersion: 1, device })).rejects.toMatchObject({ status: 413, kind: 'payload-too-large' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'https://slipy.hsclogic.link/problems/rate-limited' }), { status: 429, headers: { 'Retry-After': '120' } })))
    await expect(m.postBatch({ formatVersion: 1, device })).rejects.toMatchObject({ kind: 'rate-limited', retryAfterSeconds: 120 })
    vi.unstubAllGlobals()
  })
})
