import { describe, expect, it } from 'vitest'
import type { PaymentSlip } from '../types'
import { buildPaymentSlipView, formatPaymentDate, formatPaymentReference } from './paymentSlipView'

const slip: PaymentSlip = {
  company: { name: 'Example Company', address: 'Colombo', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#123456' },
  recipient: { name: 'A Recipient With A Very Long Full Name', identification: '', role: 'Consultant', address: '', email: '', telephone: '' },
  payment: { date: '2026-08-31', reference: 'PAY-2026-0001', title: 'Services', method: 'Cash', bankName: '', transactionReference: '', notes: '', adjustment: 0, currency: 'LKR', sealText: '', paperSize: 'a4', orientation: 'portrait' },
  items: [{ id: '1', description: 'A long description that remains available to both renderers', quantity: 2, rate: 500 }], adjustments: [],
}

describe('payment slip view model', () => {
  it('derives shared display values and calculations', () => { const view = buildPaymentSlipView(slip); expect(view.payment.date).toBe('31 Aug 2026'); expect(view.items[0].amount).toBe('Rs. 1,000.00'); expect(view.totals.final).toBe('Rs. 1,000.00'); expect(view.recipient.name).toContain('Very Long') })
  it('omits empty optional recipient and transaction details', () => { const view = buildPaymentSlipView(slip); expect(view.recipient.details).toEqual(['Consultant']); expect(view.payment.bankName).toBe(''); expect(view.payment.notes).toBe('') })
  it('provides consistent empty-state formatting', () => { expect(formatPaymentReference('')).toBe('—'); expect(formatPaymentDate('')).toBe('—') })
})
