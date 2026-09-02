import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { loadCompany, loadDraft, loadTheme, persistenceMessage, safeParse, safeRemove, safeSet, saveCompany, saveDraft, saveTheme, STORAGE_KEYS } from './storage'

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
    delete legacy.adjustments
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify({ ...legacy, company, payment }))

    const loaded = loadDraft(storage, createBasicSlip())
    expect(loaded?.company.themeColor).toBe('#123456')
    expect(loaded?.payment).toMatchObject({ currency: 'LKR', sealText: '', paperSize: 'a4', orientation: 'portrait' })
    expect(loaded?.adjustments).toEqual([])
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
