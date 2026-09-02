import { describe, expect, it } from 'vitest'
import type { PaymentSlip } from '../types'
import { buildPdf, createPdfBlob, getPdfPageMetrics, getPdfTableColumnWidths, pdfFilename } from './pdf'

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

  it('creates a reusable PDF blob for output actions', () => {
    const blob = createPdfBlob(sample)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(3000)
  })

  it.each([
    ['a4', 'portrait', 210, 297], ['a4', 'landscape', 297, 210],
    ['a5', 'portrait', 148, 210], ['a5', 'landscape', 210, 148],
    ['b5', 'portrait', 176, 250], ['b5', 'landscape', 250, 176],
    ['letter', 'portrait', 216, 279], ['letter', 'landscape', 279, 216],
  ] as const)('uses %s %s page dimensions', (paperSize, orientation, width, height) => {
    const pdf = buildPdf({ ...sample, payment: { ...sample.payment, paperSize, orientation } })
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(width, 0)
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(height, 0)
  })

  it.each([
    ['a4', 'portrait'], ['a4', 'landscape'], ['a5', 'portrait'], ['a5', 'landscape'],
    ['b5', 'portrait'], ['b5', 'landscape'], ['letter', 'portrait'], ['letter', 'landscape'],
  ] as const)('keeps %s %s page metrics within the physical page', (paperSize, orientation) => {
    const pdf = buildPdf({ ...sample, payment: { ...sample.payment, paperSize, orientation } })
    const metrics = getPdfPageMetrics(pdf, orientation)
    expect(metrics.marginX).toBeGreaterThan(0)
    expect(metrics.marginTop).toBeGreaterThan(0)
    expect(metrics.marginBottom).toBeGreaterThan(0)
    expect(metrics.marginX + metrics.contentWidth).toBeLessThanOrEqual(metrics.pageWidth)
    expect(metrics.contentTop + metrics.contentHeight).toBeCloseTo(metrics.contentBottom, 5)
    expect(metrics.contentBottom + metrics.marginBottom + metrics.footerHeight).toBeCloseTo(metrics.pageHeight, 5)
    expect(metrics.contentWidth).toBeGreaterThan(0)
    expect(metrics.contentHeight).toBeGreaterThan(0)
    expect(getPdfTableColumnWidths(metrics.contentWidth).reduce((sum, width) => sum + width, 0)).toBeCloseTo(metrics.contentWidth, 5)
  })

  it('paginates many long line items and tolerates large totals and missing optional data', () => {
    const edgeCase: PaymentSlip = { ...sample, company: { ...sample.company, name: 'An Extremely Long Company Name That Must Remain Inside The Header Without Changing The Template', address: 'A long company address that should wrap safely across the available header width' }, recipient: { ...sample.recipient, name: 'An Extremely Long Recipient Name That Must Remain Inside Its Allocated Document Area' }, payment: { ...sample.payment, reference: 'PS-2026-0001-WITH-A-LONG-MANUAL-SUFFIX', title: 'A deliberately long purpose that must not run into the document margins', bankName: '', transactionReference: '', notes: '' }, items: Array.from({ length: 45 }, (_, index) => ({ id: String(index), description: `Line ${index + 1}: a long service description that wraps safely within the table cell`, quantity: 9999, rate: 999999999.99 })) }
    const pdf = buildPdf(edgeCase)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(10000)
  })

  it('accepts a logo without failing document creation', () => {
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADUlEQVR42mNk+M/wHwAF/gL+W9eWAAAAAElFTkSuQmCC'
    expect(() => buildPdf({ ...sample, company: { ...sample.company, logo } })).not.toThrow()
  })

  it('renders notes, adjustments, acknowledgement and authorization details', () => {
    const complete: PaymentSlip = {
      ...sample,
      company: { ...sample.company, authorizedName: 'Authorized Person', authorizedDesignation: 'Finance Manager' },
      payment: { ...sample.payment, notes: 'Please retain this slip as acknowledgement of payment.', adjustment: -50, sealText: 'Thank You', method: 'Bank Transfer', bankName: 'Example Bank', transactionReference: 'TXN-123456' },
      adjustments: [
        { id: 'discount', label: 'Discount', kind: 'discount', mode: 'percentage', value: 5 },
        { id: 'vat', label: 'VAT', kind: 'tax', mode: 'percentage', value: 18 },
        { id: 'delivery', label: 'Delivery', kind: 'delivery', mode: 'fixed', value: 250 },
      ],
    }
    expect(() => buildPdf(complete)).not.toThrow()
    expect(buildPdf(complete).output('arraybuffer').byteLength).toBeGreaterThan(4000)
  })

  it.each([
    ['a4', 'portrait'], ['a4', 'landscape'],
    ['a5', 'portrait'], ['a5', 'landscape'],
    ['b5', 'portrait'], ['b5', 'landscape'],
    ['letter', 'portrait'], ['letter', 'landscape'],
  ] as const)('preserves the same representative dataset in %s %s output', (paperSize, orientation) => {
    const consistency: PaymentSlip = {
      ...sample,
      company: { ...sample.company, name: 'Very Long Company Name COMPANY-END-MARKER', address: 'Address line one\nAddress line two\nAddress line three\nADDRESS-END-MARKER', registrationNumber: 'REGISTRATION-MARKER', authorizedName: 'Very Long Authorized Person Name AUTHNAMEMARKER', authorizedDesignation: 'Very Long Authorized Professional Designation AUTHROLEMARKER' },
      recipient: { name: 'Very Long Recipient Name RECIPIENT-END-MARKER', identification: 'NIC-MARKER', role: 'A very long professional role ROLE-END-MARKER', address: 'Recipient address RECIPIENT-ADDRESS-MARKER', email: 'recipient-marker@example.com', telephone: 'PHONE-MARKER' },
      payment: { ...sample.payment, paperSize, orientation, title: 'A very long payment purpose PURPOSE-END-MARKER', transactionReference: 'A-LONG-TRANSACTION-REFERENCE-END-MARKER', notes: `${'Long payment note content. '.repeat(80)}NOTES-END-MARKER` },
      items: Array.from({ length: 12 }, (_, index) => ({ id: String(index), description: `Long item ${index + 1} description ITEM-${index + 1}-END-MARKER`, quantity: index + 1, rate: 1250.5 })),
      adjustments: Array.from({ length: 6 }, (_, index) => ({ id: String(index), label: `A deliberately long adjustment label ${index + 1} ADJ${index + 1}MARKER`, kind: 'charge' as const, mode: 'fixed' as const, value: index + 1 })),
    }
    const pdf = buildPdf(consistency)
    const output = pdf.output()
    for (const marker of ['COMPANY-END-MARKER', 'ADDRESS-END-MARKER', 'REGISTRATION-MARKER', 'RECIPIENT-END-MARKER', 'NIC-MARKER', 'ROLE-END-MARKER', 'RECIPIENT-ADDRESS-MARKER', 'PHONE-MARKER', 'PURPOSE-END-MARKER', 'ITEM-12-END-MARKER', 'ADJ6MARKER', 'NOTES-END-MARKER', 'A-LONG-TRANSACTION-REFERENCE-END-MARKER', 'AUTHNAMEMARKER', 'AUTHROLEMARKER']) expect(output).toContain(marker)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
  })
})
