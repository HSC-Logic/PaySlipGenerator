import type { PaymentSlip } from '../types'

type SimilarOptions = { reference: string; date?: string; createId?: () => string }

export const createSimilarSlip = (source: PaymentSlip, { reference, date = new Date().toLocaleDateString('en-CA'), createId = () => crypto.randomUUID() }: SimilarOptions): PaymentSlip => ({
  company: { ...source.company },
  recipient: { ...source.recipient },
  payment: { ...source.payment, date, reference, status: 'draft', paidDate: '', paidReference: '', transactionReference: '' },
  items: source.items.map(item => ({ ...item, id: createId() })),
  adjustments: source.adjustments.map(entry => ({ ...entry, id: createId() })),
})
