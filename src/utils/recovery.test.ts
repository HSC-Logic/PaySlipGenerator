import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { copySlip } from './dirtyState'
import { loadMeaningfulRecovery, persistRecoveryState } from './recovery'
import { clearRecovery, loadDraft, loadRecovery, safeGet, saveDraft, saveRecovery, STORAGE_KEYS } from './storage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

describe('crash and refresh recovery lifecycle', () => {
  it('restores edited work after refresh or close/reopen', () => {
    const storage = new MemoryStorage()
    const baseline = createBasicSlip()
    const edited = copySlip(baseline)
    edited.payment.notes = 'Work recovered after restart'
    edited.payment.reference = 'PS-2026-0042'
    expect(persistRecoveryState(storage, edited, baseline).success).toBe(true)

    const restarted = loadMeaningfulRecovery(storage, createBasicSlip())
    expect(restarted?.slip).toEqual(edited)
    expect(restarted?.baseline).toEqual(baseline)
    expect(restarted?.slip.payment.reference).toBe('PS-2026-0042')
  })

  it('does not restore or retain a blank/unchanged slip', () => {
    const storage = new MemoryStorage()
    const blank = createBasicSlip()
    saveRecovery(storage, blank, copySlip(blank), 1)
    expect(loadMeaningfulRecovery(storage, blank)).toBeNull()
    expect(persistRecoveryState(storage, blank, copySlip(blank)).success).toBe(true)
    expect(safeGet(storage, STORAGE_KEYS.recovery)).toBeNull()
  })

  it('keeps the explicit draft independent from newer recovery work', () => {
    const storage = new MemoryStorage()
    const draft = createBasicSlip()
    const recovery = copySlip(draft)
    recovery.recipient.name = 'Unsaved recovered recipient'
    saveDraft(storage, draft)
    persistRecoveryState(storage, recovery, draft)

    expect(loadDraft(storage, createBasicSlip())).toEqual(draft)
    expect(loadMeaningfulRecovery(storage, createBasicSlip())?.slip).toEqual(recovery)
  })

  it('clears recovery for New or Clear without deleting the explicit draft', () => {
    const storage = new MemoryStorage()
    const draft = createBasicSlip()
    const edited = copySlip(draft); edited.payment.title = 'Unsaved purpose'
    saveDraft(storage, draft)
    persistRecoveryState(storage, edited, draft)
    expect(clearRecovery(storage).success).toBe(true)
    expect(loadRecovery(storage, createBasicSlip())).toBeNull()
    expect(loadDraft(storage, createBasicSlip())).toEqual(draft)
  })

  it('ignores corrupted recovery data safely', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.recovery, '{corrupt')
    expect(loadMeaningfulRecovery(storage, createBasicSlip())).toBeNull()
    storage.setItem(STORAGE_KEYS.recovery, JSON.stringify({ version: 1, savedAt: 1, slip: [], baseline: {} }))
    expect(loadMeaningfulRecovery(storage, createBasicSlip())).toBeNull()
  })
})
