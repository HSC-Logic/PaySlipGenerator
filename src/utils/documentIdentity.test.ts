import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { getDocumentHeading, getDocumentTypeLabel, getPaymentMethodLabel, safeFilenameSlug } from './documentIdentity'

describe('document identity', () => {
  it.each([['payment-slip','Payment Slip','PAYMENT SLIP'],['invoice','Invoice','INVOICE'],['quotation','Quotation','QUOTATION']] as const)('resolves %s', (type,label,heading) => { const slip=createBasicSlip();slip.payment.documentType=type;expect(getDocumentTypeLabel(slip)).toBe(label);expect(getDocumentHeading(slip)).toBe(heading) })
  it('uses trimmed custom values without rendering Other',()=>{const slip=createBasicSlip();slip.payment.documentType='other';slip.payment.customDocumentType=' Service Estimate ';slip.payment.method='Other';slip.payment.customPaymentMethod=' Wise ';expect(getDocumentHeading(slip)).toBe('SERVICE ESTIMATE');expect(getPaymentMethodLabel(slip)).toBe('Wise')})
  it('defaults legacy slips and sanitizes filenames',()=>{const slip=createBasicSlip();delete slip.payment.documentType;expect(getDocumentHeading(slip)).toBe('PAYMENT SLIP');expect(safeFilenameSlug(' Service / Estimate: *? "Q" <> | ')).toBe('service-estimate-q')})
})
