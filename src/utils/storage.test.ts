import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { clearCompanyProfile, loadCompany, loadCompanyProfile, loadDraft, loadHistory, loadRecipients, loadTheme, persistenceMessage, safeParse, safeRemove, safeSet, saveCompany, saveDraft, saveHistory, saveRecipients, saveTheme, STORAGE_KEYS } from './storage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

describe('safe persisted data loading', () => {
  it('parses valid JSON and safely handles invalid, empty, and null values', () => {
    expect(safeParse('{"ok":true}')).toEqual({ ok: true })
    expect(safeParse('{invalid')).toBeNull()
    expect(safeParse('')).toBeNull()
    expect(safeParse(null)).toBeNull()
    expect(safeParse('null')).toBeNull()
  })

  it('loads a valid draft and ignores unknown fields', () => {
    const storage = new MemoryStorage()
    const draft = { ...createBasicSlip(), unknownFutureField: 'ignored' }
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft))
    expect(loadDraft(storage, createBasicSlip())).toEqual(createBasicSlip())
  })

  it('writes and loads current v1 envelopes for company, draft, and theme', () => {
    const storage = new MemoryStorage()
    const slip = createBasicSlip()
    saveCompany(storage, slip.company)
    saveDraft(storage, slip)
    saveTheme(storage, 'dark')
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.company)!)).toEqual({ version: 1, data: slip.company })
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.draft)!)).toEqual({ version: 1, data: slip })
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.theme)!)).toEqual({ version: 1, data: 'dark' })
    expect(loadCompany(storage, { ...slip.company, name: '' })).toEqual(slip.company)
    expect(loadDraft(storage, createBasicSlip())).toEqual(slip)
    expect(loadTheme(storage)).toBe('dark')
  })

  it('migrates legacy unversioned company, draft, and theme values in memory', () => {
    const storage = new MemoryStorage()
    const slip = createBasicSlip()
    storage.setItem(STORAGE_KEYS.company, JSON.stringify(slip.company))
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify(slip))
    storage.setItem(STORAGE_KEYS.theme, 'light')
    expect(loadCompany(storage, { ...slip.company, name: '' })).toEqual(slip.company)
    expect(loadDraft(storage, createBasicSlip())).toEqual(slip)
    expect(loadTheme(storage)).toBe('light')
  })

  it('rejects unknown persistence versions without treating envelope data as legacy', () => {
    const storage = new MemoryStorage()
    const fallback = createBasicSlip()
    storage.setItem(STORAGE_KEYS.company, JSON.stringify({ version: 99, data: { name: 'Do not load' } }))
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify({ version: 99, data: fallback }))
    storage.setItem(STORAGE_KEYS.theme, JSON.stringify({ version: 99, data: 'dark' }))
    expect(loadCompany(storage, fallback.company)).toEqual(fallback.company)
    expect(loadDraft(storage, fallback)).toBeNull()
    expect(loadTheme(storage)).toBeNull()
  })

  it('falls back safely when a current-version payload cannot be migrated or validated', () => {
    const storage = new MemoryStorage()
    const fallback = createBasicSlip()
    storage.setItem(STORAGE_KEYS.company, JSON.stringify({ version: 1, data: [] }))
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify({ version: 1, data: { company: {}, recipient: {}, payment: {}, items: null } }))
    storage.setItem(STORAGE_KEYS.theme, JSON.stringify({ version: 1, data: 42 }))
    expect(loadCompany(storage, fallback.company)).toEqual(fallback.company)
    expect(loadDraft(storage, fallback)).toBeNull()
    expect(loadTheme(storage)).toBeNull()
  })

  it.each([
    ['an array', []],
    ['an object missing items', { company: {}, recipient: {}, payment: {} }],
    ['null items', { company: {}, recipient: {}, payment: {}, items: null }],
  ])('rejects %s as a draft without throwing', (_name, value) => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify(value))
    expect(loadDraft(storage, createBasicSlip())).toBeNull()
  })

  it('returns null for invalid JSON and empty draft storage', () => {
    const storage = new MemoryStorage()
    expect(loadDraft(storage, createBasicSlip())).toBeNull()
    storage.setItem(STORAGE_KEYS.draft, '{bad json')
    expect(loadDraft(storage, createBasicSlip())).toBeNull()
  })

  it('migrates a legacy draft by supplying newer optional fields', () => {
    const storage = new MemoryStorage()
    const legacy = createBasicSlip() as unknown as Record<string, unknown>
    const company = { ...(legacy.company as Record<string, unknown>) }
    const payment = { ...(legacy.payment as Record<string, unknown>) }
    delete company.themeColor
    delete payment.currency
    delete payment.sealText
    delete payment.paperSize
    delete payment.orientation
    delete payment.status
    delete payment.paidDate
    delete payment.paidReference
    delete legacy.adjustments
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify({ ...legacy, company, payment }))

    const loaded = loadDraft(storage, createBasicSlip())
    expect(loaded?.company.themeColor).toBe('#123456')
    expect(loaded?.payment).toMatchObject({ currency: 'LKR', sealText: '', paperSize: 'a4', orientation: 'portrait', status: 'draft', paidDate: '', paidReference: '' })
    expect(loaded?.adjustments).toEqual([])
  })

  it('persists paid status metadata and safely defaults unknown status values', () => {
    const storage = new MemoryStorage()
    const paid = createBasicSlip()
    paid.payment.status = 'paid'
    paid.payment.paidDate = '2026-09-03'
    paid.payment.paidReference = 'SETTLEMENT-42'
    saveDraft(storage, paid)
    expect(loadDraft(storage, createBasicSlip())?.payment).toMatchObject({ status: 'paid', paidDate: '2026-09-03', paidReference: 'SETTLEMENT-42' })

    const invalid = structuredClone(paid) as unknown as { payment: Record<string, unknown> }
    invalid.payment.status = 'archived'
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify(invalid))
    expect(loadDraft(storage, createBasicSlip())?.payment).toMatchObject({ status: 'draft', paidDate: '2026-09-03', paidReference: 'SETTLEMENT-42' })
  })

  it.each([
    ['root fields', { description: 'Legacy service', amount: 1250.5 }],
    ['payment fields', { payment: { description: 'Legacy service', amount: '1250.50' } }],
  ])('migrates legacy description and amount from %s into one line item', (_name, legacyFields) => {
    const storage = new MemoryStorage()
    const legacy = createBasicSlip() as unknown as Record<string, unknown>
    delete legacy.items
    const payment = { ...(legacy.payment as Record<string, unknown>), ...('payment' in legacyFields ? legacyFields.payment : {}) }
    const value = { ...legacy, ...legacyFields, payment }
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify(value))
    expect(loadDraft(storage, createBasicSlip())?.items).toEqual([{ id: 'item-1', description: 'Legacy service', quantity: 1, rate: 1250.5 }])
  })

  it('rejects a pre-item draft when its legacy amount is malformed', () => {
    const storage = new MemoryStorage()
    const legacy = createBasicSlip() as unknown as Record<string, unknown>
    delete legacy.items
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify({ ...legacy, description: 'Legacy service', amount: 'not-a-number' }))
    expect(loadDraft(storage, createBasicSlip())).toBeNull()
  })

  it('recovers a malformed company profile field-by-field', () => {
    const storage = new MemoryStorage()
    const fallback = createBasicSlip().company
    storage.setItem(STORAGE_KEYS.company, JSON.stringify({ name: 42, address: 'Valid legacy address', unknown: true }))
    expect(loadCompany(storage, fallback)).toEqual({ ...fallback, address: 'Valid legacy address' })
    storage.setItem(STORAGE_KEYS.company, JSON.stringify([]))
    expect(loadCompany(storage, fallback)).toEqual(fallback)
  })

  it('round-trips company, draft, and theme through their storage APIs', () => {
    const storage = new MemoryStorage()
    const slip = createBasicSlip()
    expect(saveCompany(storage, slip.company).success).toBe(true)
    expect(saveDraft(storage, slip).success).toBe(true)
    expect(saveTheme(storage, 'dark').success).toBe(true)
    expect(loadCompany(storage, { ...slip.company, name: '' })).toEqual(slip.company)
    expect(loadDraft(storage, createBasicSlip())).toEqual(slip)
    expect(loadTheme(storage)).toBe('dark')
    storage.setItem(STORAGE_KEYS.theme, 'unknown')
    expect(loadTheme(storage)).toBeNull()
  })

  it('distinguishes a missing profile from a valid returning-user profile', () => {
    const storage = new MemoryStorage()
    const fallback = { ...createBasicSlip().company, name: '' }
    expect(loadCompanyProfile(storage, fallback)).toBeNull()
    expect(saveCompany(storage, createBasicSlip().company).success).toBe(true)
    expect(loadCompanyProfile(storage, fallback)).toEqual(createBasicSlip().company)
  })

  it('updates and clears the single saved company profile without changing caller data', () => {
    const storage = new MemoryStorage()
    const original = createBasicSlip().company
    const updated = { ...original, name: 'Updated Company' }
    saveCompany(storage, original)
    saveCompany(storage, updated)
    expect(loadCompanyProfile(storage, original)).toEqual(updated)
    expect(clearCompanyProfile(storage).success).toBe(true)
    expect(loadCompanyProfile(storage, original)).toBeNull()
    expect(updated.name).toBe('Updated Company')
  })

  it('persists Base64 logos but rejects stale object URLs during loading', () => {
    const storage = new MemoryStorage()
    const fallback = { ...createBasicSlip().company, logo: '' }
    const profile = { ...fallback, logo: 'data:image/png;base64,AAAA' }
    saveCompany(storage, profile)
    expect(loadCompanyProfile(storage, fallback)?.logo).toBe(profile.logo)
    storage.setItem(STORAGE_KEYS.company, JSON.stringify({ ...profile, logo: 'blob:https://example.test/stale' }))
    expect(loadCompanyProfile(storage, fallback)?.logo).toBe('')
  })

  it('handles corrupted and unavailable profile storage without crashing', () => {
    const storage = new MemoryStorage()
    const fallback = createBasicSlip().company
    storage.setItem(STORAGE_KEYS.company, '{broken')
    expect(loadCompanyProfile(storage, fallback)).toBeNull()
    storage.getItem = () => { throw new DOMException('blocked', 'SecurityError') }
    storage.setItem = () => { throw new DOMException('blocked', 'SecurityError') }
    storage.removeItem = () => { throw new DOMException('blocked', 'SecurityError') }
    expect(loadCompanyProfile(storage, fallback)).toBeNull()
    expect(saveCompany(storage, fallback)).toMatchObject({ success: false, reason: 'access-denied' })
    expect(clearCompanyProfile(storage)).toMatchObject({ success: false, reason: 'access-denied' })
  })

  it('round-trips saved recipients with stable IDs while omitting identification', () => {
    const storage = new MemoryStorage()
    const recipients = [
      { id: 'recipient-1', name: 'Alex Silva', role: 'Designer', address: '', email: '', telephone: '' },
      { id: 'recipient-2', name: 'Alex Silva', role: '', address: 'Colombo', email: 'alex@example.com', telephone: '' },
    ]
    expect(saveRecipients(storage, recipients).success).toBe(true)
    expect(loadRecipients(storage)).toEqual(recipients)
    expect(storage.getItem(STORAGE_KEYS.recipients)).not.toContain('identification')
  })

  it('loads legacy recipient arrays and skips malformed or duplicate-ID records', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.recipients, JSON.stringify([
      { id: 'valid', name: 'Valid Recipient', role: 42, unknown: 'ignored' },
      { id: 'valid', name: 'Duplicate ID' },
      { id: '', name: 'Missing ID' },
      { id: 'missing-name' },
      null,
    ]))
    expect(loadRecipients(storage)).toEqual([{ id: 'valid', name: 'Valid Recipient', role: '', address: '', email: '', telephone: '' }])
  })

  it('returns an empty recipient list for empty, corrupted, non-array, or unknown-version data', () => {
    const storage = new MemoryStorage()
    expect(loadRecipients(storage)).toEqual([])
    for (const value of ['{broken', JSON.stringify({ name: 'not-an-array' }), JSON.stringify({ version: 99, data: [] })]) {
      storage.setItem(STORAGE_KEYS.recipients, value)
      expect(loadRecipients(storage)).toEqual([])
    }
  })

  it('reports blocked recipient writes without losing the in-memory collection', () => {
    const storage = new MemoryStorage()
    const recipients = [{ id: 'recipient-1', name: 'Saved', role: '', address: '', email: '', telephone: '' }]
    storage.setItem = () => { throw new DOMException('blocked', 'SecurityError') }
    expect(saveRecipients(storage, recipients)).toMatchObject({ success: false, reason: 'access-denied' })
    expect(recipients).toHaveLength(1)
  })

  it('round-trips history snapshots with record IDs independent from references', () => {
    const storage = new MemoryStorage()
    const first = createBasicSlip()
    const second = structuredClone(first)
    second.recipient.name = 'Second snapshot'
    const records = [
      { id: 'record-1', createdAt: 10, updatedAt: 20, slip: first },
      { id: 'record-2', createdAt: 30, updatedAt: 40, slip: second },
    ]
    expect(saveHistory(storage, records).success).toBe(true)
    const loaded = loadHistory(storage, createBasicSlip())
    expect(loaded.map(record => record.id)).toEqual(['record-1', 'record-2'])
    expect(loaded.map(record => record.slip.payment.reference)).toEqual(['PAY/001', 'PAY/001'])
    loaded[0].slip.company.name = 'Edited copy'
    expect(records[0].slip.company.name).toBe('Example Company')
  })

  it('migrates legacy raw-slip history entries to deterministic IDs', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.history, JSON.stringify([createBasicSlip()]))
    const firstLoad = loadHistory(storage, createBasicSlip())
    const secondLoad = loadHistory(storage, createBasicSlip())
    expect(firstLoad).toHaveLength(1)
    expect(firstLoad[0].id).toMatch(/^legacy-/)
    expect(secondLoad[0].id).toBe(firstLoad[0].id)
    expect(firstLoad[0]).toMatchObject({ createdAt: 0, updatedAt: 0 })
  })

  it('skips malformed and duplicate-ID history records without crashing', () => {
    const storage = new MemoryStorage()
    const slip = createBasicSlip()
    storage.setItem(STORAGE_KEYS.history, JSON.stringify({ version: 1, data: [
      { id: 'valid', createdAt: 1, updatedAt: 2, slip },
      { id: 'valid', createdAt: 3, updatedAt: 4, slip },
      { id: 'broken', slip: { company: null } },
      null,
    ] }))
    expect(loadHistory(storage, createBasicSlip())).toEqual([{ id: 'valid', createdAt: 1, updatedAt: 2, slip }])
    storage.setItem(STORAGE_KEYS.history, '{broken')
    expect(loadHistory(storage, createBasicSlip())).toEqual([])
  })

  it.each([
    ['QuotaExceededError', 'quota-exceeded', 'storage is full'],
    ['SecurityError', 'access-denied', 'blocked local storage'],
    ['UnexpectedError', 'unknown', 'current form remains open'],
  ] as const)('classifies %s writes without throwing or reporting success', (name, reason, message) => {
    const storage = new MemoryStorage()
    storage.setItem = () => { throw name === 'UnexpectedError' ? Object.assign(new Error('failed'), { name }) : new DOMException('failed', name) }
    const slip = createBasicSlip()
    const before = structuredClone(slip)
    const result = saveDraft(storage, slip)
    expect(result).toMatchObject({ success: false, reason, errorName: name })
    expect(persistenceMessage(result, 'The draft')).toContain(message)
    expect(slip).toEqual(before)
  })

  it('returns the same failure contract for centralized set and remove operations', () => {
    const storage = new MemoryStorage()
    storage.setItem = () => { throw new DOMException('denied', 'SecurityError') }
    storage.removeItem = () => { throw new Error('remove failed') }
    expect(safeSet(storage, 'key', 'value')).toMatchObject({ success: false, reason: 'access-denied' })
    expect(safeRemove(storage, 'key')).toMatchObject({ success: false, reason: 'unknown' })
  })
})
