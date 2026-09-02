import { describe, expect, it } from 'vitest'
import { currentOrNextReference, generateReference, nextReference, parseReference, reserveNextReference } from './reference'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

describe('payment references', () => {
  it('uses the PS year format and four-digit padding', () => { expect(nextReference(2026, 1)).toBe('PS-2026-0001'); expect(nextReference(2026, 120)).toBe('PS-2026-0120') })
  it('starts at one and persists the next sequence', () => { const storage = new MemoryStorage(); expect(reserveNextReference({ year: 2026, storage })).toBe('PS-2026-0001'); expect(reserveNextReference({ year: 2026, storage })).toBe('PS-2026-0002') })
  it('continues from the legacy counter and a higher persisted draft reference', () => { const storage = new MemoryStorage(); storage.setItem('payment-slip-sequence-2026', '8'); expect(reserveNextReference({ year: 2026, storage, existingReferences: ['PS-2026-0042', 'PAY-2026-0100'] })).toBe('PS-2026-0043') })
  it('does not reuse issued references and starts a new sequence each year', () => { const storage = new MemoryStorage(); expect(reserveNextReference({ year: 2026, storage })).toBe('PS-2026-0001'); expect(reserveNextReference({ year: 2027, storage })).toBe('PS-2027-0001'); expect(reserveNextReference({ year: 2026, storage })).toBe('PS-2026-0002') })
  it('reuses the active reference on refresh but explicitly generates a new one', () => { const storage = new MemoryStorage(); const session = new MemoryStorage(); expect(currentOrNextReference({ year: 2026, storage, session })).toBe('PS-2026-0001'); expect(currentOrNextReference({ year: 2026, storage, session })).toBe('PS-2026-0001'); expect(generateReference({ year: 2026, storage, session })).toBe('PS-2026-0002') })
  it('ignores malformed and legacy references when parsing PS sequences', () => { expect(parseReference('PS-2026-0042')).toEqual({ year: 2026, sequence: 42 }); expect(parseReference('PAY-2026-0042')).toBeNull(); expect(parseReference('custom-reference')).toBeNull() })
  it('recovers from malformed persisted reference records', () => {
    const storage = new MemoryStorage()
    storage.setItem('payment-slip-reference-state-v1', JSON.stringify({ version: 1, years: { 2026: { last: '99', issued: null }, 2025: { last: 4, issued: ['PS-2025-0004'] } } }))
    expect(reserveNextReference({ year: 2026, storage })).toBe('PS-2026-0001')
    expect(reserveNextReference({ year: 2025, storage })).toBe('PS-2025-0005')
  })
  it('surfaces reference storage failures while preserving the generated in-memory reference', () => {
    const storage = new MemoryStorage()
    const session = new MemoryStorage()
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
    session.setItem = () => { throw new DOMException('denied', 'SecurityError') }
    const failures: string[] = []
    expect(generateReference({ year: 2026, storage, session, onPersistenceFailure: result => { if (!result.success) failures.push(result.reason) } })).toBe('PS-2026-0001')
    expect(failures).toEqual(['quota-exceeded', 'access-denied'])
  })
})
