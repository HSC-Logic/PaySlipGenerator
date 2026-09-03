import { describe, expect, it } from 'vitest'
import { adjustmentAmount, calculatePaymentTotals, finalTotal, formatCurrency, itemAmount, subtotal } from './currency'
const items = [{ id: '1', description: 'Consulting', quantity: 2, rate: 1500 }, { id: '2', description: 'Travel', quantity: 1, rate: 500 }]
describe('payment calculations', () => {
  it('calculates a line amount', () => expect(itemAmount(items[0])).toBe(3000))
  it('calculates subtotal', () => expect(subtotal(items)).toBe(3500))
  it('applies positive and negative adjustments', () => { expect(finalTotal(items, 500)).toBe(4000); expect(finalTotal(items, -250)).toBe(3250) })
  it('formats LKR', () => expect(formatCurrency(8000)).toBe('Rs.\u00a08,000.00'))
  it('formats supported foreign currencies', () => { expect(formatCurrency(8000, 'USD')).toBe('$8,000.00'); expect(formatCurrency(8000, 'EUR')).toBe('€8,000.00'); expect(formatCurrency(8000, 'AUD')).toBe('A$8,000.00') })
  it('applies percentage discounts and charges', () => { const discount = { id: 'd', label: 'Discount', kind: 'discount' as const, mode: 'percentage' as const, value: 10 }; const vat = { id: 'v', label: 'VAT', kind: 'tax' as const, mode: 'percentage' as const, value: 18 }; expect(adjustmentAmount(discount, 1000)).toBe(-100); expect(finalTotal([{ id: 'x', description: 'Item', quantity: 1, rate: 1000 }], 0, [discount, vat])).toBe(1080) })
  it('rounds decimal multiplication to currency minor units without visible floating-point artifacts', () => {
    const decimalItems = [
      { id: '1', description: 'Fraction', quantity: 1.5, rate: 19.99 },
      { id: '2', description: 'Small', quantity: 1, rate: 0.1 },
      { id: '3', description: 'Small', quantity: 1, rate: 0.2 },
    ]
    expect(calculatePaymentTotals(decimalItems, 0)).toMatchObject({ itemAmounts: [29.99, 0.1, 0.2], subtotal: 30.29, final: 30.29 })
    expect(formatCurrency(calculatePaymentTotals(decimalItems, 0).final, 'USD')).toBe('$30.29')
  })
  it('handles zero, empty, negative, and large values deterministically', () => {
    expect(itemAmount({ quantity: '', rate: '' })).toBe(0)
    expect(itemAmount({ quantity: 0, rate: 100 })).toBe(0)
    expect(itemAmount({ quantity: -2, rate: 10 })).toBe(-20)
    expect(itemAmount({ quantity: 99999.99, rate: 99999.99 })).toBe(9999998000)
  })
  it('rounds percentage adjustments to the nearest minor unit in the shared calculation', () => {
    const result = calculatePaymentTotals([{ id: 'x', description: 'Item', quantity: 1, rate: 10.01 }], 0.1, [{ id: 'v', label: 'VAT', kind: 'tax', mode: 'percentage', value: 17.5 }])
    expect(result).toEqual({ itemAmounts: [10.01], subtotal: 10.01, adjustmentAmounts: [1.75], final: 11.86 })
  })
})
