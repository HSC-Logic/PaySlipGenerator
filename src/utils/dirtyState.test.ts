import { describe, expect, it, vi } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { copySlip, hasUnsavedChanges, prepareDestructiveReplacement } from './dirtyState'

const replacement = () => {
  const next = createBasicSlip()
  next.payment.reference = 'PS-2026-0042'
  return next
}

describe('payment slip dirty state', () => {
  it('treats an unchanged initial or saved slip as clean', () => {
    const baseline = createBasicSlip()
    expect(hasUnsavedChanges(copySlip(baseline), baseline)).toBe(false)
  })

  it.each([
    ['company', (slip: ReturnType<typeof createBasicSlip>) => { slip.company.name = 'Changed company' }],
    ['recipient', (slip: ReturnType<typeof createBasicSlip>) => { slip.recipient.name = 'Changed recipient' }],
    ['notes only', (slip: ReturnType<typeof createBasicSlip>) => { slip.payment.notes = 'Unsaved note' }],
    ['payment metadata', (slip: ReturnType<typeof createBasicSlip>) => { slip.payment.method = 'Cheque' }],
    ['amount', (slip: ReturnType<typeof createBasicSlip>) => { slip.items[0].rate = 2500 }],
    ['multiple line items', (slip: ReturnType<typeof createBasicSlip>) => { slip.items.push({ id: 'item-2', description: 'Extra work', quantity: 1, rate: 500 }) }],
    ['adjustment', (slip: ReturnType<typeof createBasicSlip>) => { slip.adjustments.push({ id: 'tax-1', label: 'VAT', kind: 'tax', mode: 'percentage', value: 18 }) }],
  ])('detects a change to %s', (_name, change) => {
    const baseline = createBasicSlip()
    const current = copySlip(baseline)
    change(current)
    expect(hasUnsavedChanges(current, baseline)).toBe(true)
  })

  it('creates a new slip without prompting when the current slip is unchanged', () => {
    const current = createBasicSlip()
    const confirmDiscard = vi.fn(() => false)
    const createReplacement = vi.fn(replacement)

    expect(prepareDestructiveReplacement({ current, baseline: copySlip(current), confirmDiscard, createReplacement })).toEqual(replacement())
    expect(confirmDiscard).not.toHaveBeenCalled()
    expect(createReplacement).toHaveBeenCalledOnce()
  })

  it('preserves the exact current state and does not consume a reference when cancelled', () => {
    const baseline = createBasicSlip()
    const current = copySlip(baseline)
    current.payment.notes = 'Do not lose this'
    const before = copySlip(current)
    const confirmDiscard = vi.fn(() => false)
    const createReplacement = vi.fn(replacement)

    expect(prepareDestructiveReplacement({ current, baseline, confirmDiscard, createReplacement })).toBeNull()
    expect(current).toEqual(before)
    expect(confirmDiscard).toHaveBeenCalledOnce()
    expect(createReplacement).not.toHaveBeenCalled()
  })

  it('creates the replacement after modified data is confirmed for discard', () => {
    const baseline = createBasicSlip()
    const current = copySlip(baseline)
    current.recipient.name = 'Unsaved recipient'
    const createReplacement = vi.fn(replacement)

    expect(prepareDestructiveReplacement({ current, baseline, confirmDiscard: () => true, createReplacement })).toEqual(replacement())
    expect(createReplacement).toHaveBeenCalledOnce()
  })

  it('uses the last saved snapshot as the baseline', () => {
    const savedDraft = createBasicSlip()
    const loaded = copySlip(savedDraft)
    expect(hasUnsavedChanges(loaded, savedDraft)).toBe(false)
    loaded.items.push({ id: 'item-2', description: 'After save', quantity: 2, rate: 100 })
    expect(hasUnsavedChanges(loaded, savedDraft)).toBe(true)
  })
})
