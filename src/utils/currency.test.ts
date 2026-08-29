import { describe, expect, it } from 'vitest'
import { adjustmentAmount, finalTotal, formatCurrency, itemAmount, subtotal } from './currency'
const items = [{ id: '1', description: 'Consulting', quantity: 2, rate: 1500 }, { id: '2', description: 'Travel', quantity: 1, rate: 500 }]
describe('payment calculations', () => {
  it('calculates a line amount', () => expect(itemAmount(items[0])).toBe(3000))
  it('calculates subtotal', () => expect(subtotal(items)).toBe(3500))
  it('applies positive and negative adjustments', () => { expect(finalTotal(items, 500)).toBe(4000); expect(finalTotal(items, -250)).toBe(3250) })
  it('formats LKR', () => expect(formatCurrency(8000)).toBe('Rs. 8,000.00'))
  it('formats supported foreign currencies', () => { expect(formatCurrency(8000, 'USD')).toBe('$ 8,000.00'); expect(formatCurrency(8000, 'EUR')).toBe('€ 8,000.00') })
  it('applies percentage discounts and charges', () => { const discount = { id: 'd', label: 'Discount', kind: 'discount' as const, mode: 'percentage' as const, value: 10 }; const vat = { id: 'v', label: 'VAT', kind: 'tax' as const, mode: 'percentage' as const, value: 18 }; expect(adjustmentAmount(discount, 1000)).toBe(-100); expect(finalTotal([{ id: 'x', description: 'Item', quantity: 1, rate: 1000 }], 0, [discount, vat])).toBe(1080) })
})
