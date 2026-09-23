import { describe, expect, it } from 'vitest'
import type { PaymentSlip } from '../types'
import { createSimilarSlip } from './similarSlip'

const source: PaymentSlip = {
  company: { name: 'Company', address: 'Address', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#0b1f3a' },
  recipient: { name: 'Recipient', identification: '', role: 'Role', address: '', email: '', telephone: '' },
  payment: { date: '2026-01-01', reference: 'PS-2026-0001', title: 'Service', method: 'Bank Transfer', status: 'draft', paidDate: '', paidReference: '', bankName: 'Bank', transactionReference: 'OLD-TX', notes: '', adjustment: 0, currency: 'LKR', sealText: '', paperSize: 'a4', orientation: 'portrait' },
  items: [{ id: 'old-item', description: 'Service', quantity: 1, rate: 100 }],
  adjustments: [{ id: 'old-adjustment', label: 'Tax', kind: 'tax', mode: 'percentage', value: 10 }],
}

describe('create similar slip', () => {
  it('deep-clones nested data and assigns a new transaction identity', () => {
    let id = 0
    const similar = createSimilarSlip(source, { reference: 'PS-2026-0002', date: '2026-02-02', createId: () => `new-${++id}` })
    expect(similar.payment.reference).toBe('PS-2026-0002')
    expect(similar.payment.date).toBe('2026-02-02')
    expect(similar.payment.transactionReference).toBe('')
    expect(similar.payment).toMatchObject({ status: 'draft', paidDate: '', paidReference: '' })
    expect(similar.items[0].id).toBe('new-1')
    expect(similar.adjustments[0].id).toBe('new-2')
    similar.items[0].description = 'Changed'
    similar.adjustments[0].label = 'Changed'
    similar.recipient.name = 'Changed'
    expect(source.items[0].description).toBe('Service')
    expect(source.adjustments[0].label).toBe('Tax')
    expect(source.recipient.name).toBe('Recipient')
  })
})
