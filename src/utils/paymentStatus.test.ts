import { describe, expect, it } from 'vitest'
import type { PaymentStatus } from '../types'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { changePaymentStatus, paymentStatuses } from './paymentStatus'

describe('payment status transitions', () => {
  it.each(paymentStatuses.flatMap(from => paymentStatuses.map(to => [from, to] as const)))('supports %s → %s and preserves paid metadata', (from, to) => {
    const payment = { ...createBasicSlip().payment, status: from as PaymentStatus, paidDate: '2026-09-03', paidReference: 'SETTLEMENT-42' }
    const changed = changePaymentStatus(payment, to)
    expect(changed.status).toBe(to)
    expect(changed.paidDate).toBe('2026-09-03')
    expect(changed.paidReference).toBe('SETTLEMENT-42')
    expect(payment.status).toBe(from)
  })
})
