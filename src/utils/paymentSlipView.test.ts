import { describe, expect, it } from 'vitest'
import { createBasicSlip, createLongContentSlip } from '../test/fixtures/paymentSlips'
import { buildPaymentSlipView, formatPaymentDate, formatPaymentReference } from './paymentSlipView'

describe('payment slip view model', () => {
  it('derives shared display values and calculations', () => { const slip = createBasicSlip(); const view = buildPaymentSlipView(slip); expect(view.payment.date).toBe('31 Aug 2026'); expect(view.items[0].amount).toBe('Rs. 3,000.00'); expect(view.totals.final).toBe('Rs. 3,000.00'); expect(view.recipient.name).toBe('Test Recipient') })
  it('omits empty optional recipient and transaction details', () => { const view = buildPaymentSlipView(createBasicSlip()); expect(view.recipient.details).toEqual(['Role / designation']); expect(view.payment.bankName).toBe(''); expect(view.payment.notes).toBe('') })
  it('keeps all long source values available to Preview and PDF', () => { const slip = createLongContentSlip(); const view = buildPaymentSlipView(slip); expect(view.company.name).toBe(slip.company.name); expect(view.company.address).toBe(slip.company.address); expect(view.recipient.name).toBe(slip.recipient.name); expect(view.recipient.details).toEqual(expect.arrayContaining([slip.recipient.role, `NIC / ID: ${slip.recipient.identification}`, slip.recipient.address, slip.recipient.email, slip.recipient.telephone])); expect(view.payment.title).toBe(slip.payment.title); expect(view.payment.notes).toBe(slip.payment.notes); expect(view.items.map(item => item.description)).toEqual(slip.items.map(item => item.description)); expect(view.totals.entries).toHaveLength(slip.adjustments.length) })
  it('provides consistent empty-state formatting', () => { expect(formatPaymentReference('')).toBe('—'); expect(formatPaymentDate('')).toBe('—') })
})
