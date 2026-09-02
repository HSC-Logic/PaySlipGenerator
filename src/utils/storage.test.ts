import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { loadCompany, loadDraft, loadTheme, safeParse, saveCompany, saveDraft, saveTheme, STORAGE_KEYS } from './storage'

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
    expect(saveCompany(storage, slip.company)).toBe(true)
    expect(saveDraft(storage, slip)).toBe(true)
    expect(saveTheme(storage, 'dark')).toBe(true)
    expect(loadCompany(storage, { ...slip.company, name: '' })).toEqual(slip.company)
    expect(loadDraft(storage, createBasicSlip())).toEqual(slip)
    expect(loadTheme(storage)).toBe('dark')
    storage.setItem(STORAGE_KEYS.theme, 'unknown')
    expect(loadTheme(storage)).toBeNull()
  })
})
