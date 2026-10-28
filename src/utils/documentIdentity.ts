import type { Payment, PaymentSlip } from '../types'

const documentLabels = { 'payment-slip': 'Payment Slip', invoice: 'Invoice', quotation: 'Quotation', other: '' } as const
type PaymentSource = Payment | PaymentSlip
const paymentFrom = (source: PaymentSource) => 'payment' in source ? source.payment : source

export const getDocumentTypeLabel = (source: PaymentSource) => {
  const payment = paymentFrom(source)
  const type = payment.documentType ?? 'payment-slip'
  return type === 'other' ? payment.customDocumentType?.trim() || '' : documentLabels[type]
}

export const getDocumentHeading = (source: PaymentSource) => getDocumentTypeLabel(source).toLocaleUpperCase()

export const getPaymentMethodLabel = (source: PaymentSource) => {
  const payment = paymentFrom(source)
  return payment.method === 'Other' ? payment.customPaymentMethod?.trim() || '' : payment.method
}

export const safeFilenameSlug = (value: string, lowercase = true) => {
  const normalized = value.trim().normalize('NFKD').replace(/[\\/:*?"<>|]/g, ' ')
  const cased = lowercase ? normalized.toLocaleLowerCase() : normalized
  return cased.replace(lowercase ? /[^a-z0-9]+/g : /[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document'
}
