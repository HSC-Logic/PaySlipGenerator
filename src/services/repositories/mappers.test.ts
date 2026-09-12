import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../../test/fixtures/paymentSlips'
import { slipToRow } from './mappers'
describe('cloud mapping', () => { it('creates immutable snapshots and preserves document identity', () => { const slip = createBasicSlip(); slip.payment.documentType = 'other'; slip.payment.customDocumentType = 'Receipt'; slip.payment.method = 'Other'; slip.payment.customPaymentMethod = 'Wise'; const row = slipToRow(slip, 'user', 'company'); slip.company.name = 'Changed'; expect((row.company_snapshot as typeof slip.company).name).toBe('Example Company'); expect(row).toMatchObject({ document_type: 'other', custom_document_type: 'Receipt', payment_method: 'Other', custom_payment_method: 'Wise', final_total: 3000 }) }) })
