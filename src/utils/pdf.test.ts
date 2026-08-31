import { describe, expect, it } from 'vitest'
import type { PaymentSlip } from '../types'
import { buildPdf, pdfFilename } from './pdf'

const sample: PaymentSlip = {
  company: { name: 'Example Company', address: 'Colombo', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#123456' },
  recipient: { name: 'A Recipient With A Deliberately Long Name For Wrapping', identification: '', role: '', address: '', email: '', telephone: '' },
  payment: { date: '2026-08-31', reference: 'PAY/001', title: 'Consulting services', method: 'Cash', bankName: '', transactionReference: '', notes: '', adjustment: 0, currency: 'LKR', sealText: '', paperSize: 'a4', orientation: 'portrait' },
  items: [{ id: '1', description: 'A deliberately long line-item description that must wrap without changing the calculated amount', quantity: 2, rate: 1500 }],
  adjustments: [],
}

describe('PDF generation', () => {
  it('builds a non-empty document without downloading it', () => {
    const pdf = buildPdf(sample)
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(3000)
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 0)
    expect(pdfFilename(sample)).toBe('Payment-Slip-PAY-001-A-Recipient-With-A-Deliberately-Long-Name-For-Wrapping.pdf')
  })
})
