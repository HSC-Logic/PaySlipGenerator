import type { Payment, PaymentStatus } from '../types'

export const paymentStatuses: readonly PaymentStatus[] = ['draft', 'pending', 'paid', 'cancelled']

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

/** Status changes preserve paid metadata so a temporary transition is reversible. */
export const changePaymentStatus = (payment: Payment, status: PaymentStatus): Payment => ({ ...payment, status })
