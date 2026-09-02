import { describe, expect, it } from 'vitest'
import { contentMarkers, createBasicSlip, createLongContentSlip, createMultiPageSlip, createTypicalSlip } from '../test/fixtures/paymentSlips'
import { buildPdf, createPdfBlob, getPdfPageMetrics, getPdfTableColumnWidths, pdfFilename } from './pdf'

const formats = [
  ['a4', 'portrait', 210, 297], ['a4', 'landscape', 297, 210],
  ['a5', 'portrait', 148, 210], ['a5', 'landscape', 210, 148],
  ['b5', 'portrait', 176, 250], ['b5', 'landscape', 250, 176],
  ['letter', 'portrait', 216, 279], ['letter', 'landscape', 279, 216],
] as const

describe('PDF document generation', () => {
  it('builds a reusable non-empty PDF without initiating a download', () => {
    const pdf = buildPdf(createBasicSlip())
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(3000)
    const blob = createPdfBlob(createBasicSlip())
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(3000)
  })

  it('creates a filesystem-safe, meaningful filename', () => {
    const slip = createBasicSlip()
    slip.recipient.name = 'A Recipient / Accounts'
    expect(pdfFilename(slip)).toBe('Payment-Slip-PAY-001-A-Recipient-Accounts.pdf')
  })

  describe('page dimensions and geometry', () => {
    it.each(formats)('uses correct %s %s dimensions', (paperSize, orientation, width, height) => {
      const slip = createBasicSlip(); slip.payment.paperSize = paperSize; slip.payment.orientation = orientation
      const pdf = buildPdf(slip)
      expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(width, 0)
      expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(height, 0)
      if (orientation === 'landscape') expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(pdf.internal.pageSize.getHeight())
      else expect(pdf.internal.pageSize.getHeight()).toBeGreaterThan(pdf.internal.pageSize.getWidth())
    })

    it.each(formats)('keeps %s %s content regions inside the physical page', (paperSize, orientation) => {
      const slip = createBasicSlip(); slip.payment.paperSize = paperSize; slip.payment.orientation = orientation
      const pdf = buildPdf(slip)
      const metrics = getPdfPageMetrics(pdf, orientation)
      expect(metrics.marginX).toBeGreaterThan(0)
      expect(metrics.marginTop).toBeGreaterThan(0)
      expect(metrics.marginBottom).toBeGreaterThan(0)
      expect(metrics.contentTop).toBeGreaterThanOrEqual(metrics.marginTop)
      expect(metrics.contentBottom).toBeLessThan(metrics.pageHeight)
      expect(metrics.contentTop).toBeLessThan(metrics.contentBottom)
      expect(metrics.marginX + metrics.contentWidth).toBeLessThanOrEqual(metrics.pageWidth)
      expect(metrics.contentTop + metrics.contentHeight).toBeCloseTo(metrics.contentBottom, 5)
      expect(metrics.contentBottom + metrics.marginBottom + metrics.footerHeight).toBeCloseTo(metrics.pageHeight, 5)
      const columns = getPdfTableColumnWidths(metrics.contentWidth)
      expect(columns).toHaveLength(5)
      expect(columns.every(width => width > 0)).toBe(true)
      expect(columns.reduce((sum, width) => sum + width, 0)).toBeCloseTo(metrics.contentWidth, 5)
    })
  })

  describe('content preservation', () => {
    it.each(formats)('preserves required long-form data in %s %s output', (paperSize, orientation) => {
      const slip = createLongContentSlip(paperSize, orientation)
      const output = buildPdf(slip).output()
      const required = [...Object.values(contentMarkers), 'recipient-marker@example.com', 'ITEM12ENDMARKER']
      for (const marker of required) expect(output).toContain(marker)
    })

    it('includes typical optional document sections', () => {
      const output = buildPdf(createTypicalSlip()).output()
      for (const value of ['PV-12345', 'Authorized Person', 'Finance Manager', 'Example Bank', 'TXN-123456', 'THANK YOU']) expect(output).toContain(value)
    })

    it('accepts a logo without preventing document creation', () => {
      const slip = createBasicSlip()
      slip.company.logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADUlEQVR42mNk+M/wHwAF/gL+W9eWAAAAAElFTkSuQmCC'
      expect(() => buildPdf(slip)).not.toThrow()
    })
  })

  describe('multi-page flow', () => {
    it.each([['portrait'], ['landscape']] as const)('paginates %s items without dropping order, totals, or creating an empty final page', orientation => {
      const slip = createMultiPageSlip(45, 'a4', orientation)
      const pdf = buildPdf(slip)
      const output = pdf.output()
      expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
      for (let index = 1; index <= 45; index += 1) expect(output).toContain(`ITEM${index}MARKER`)
      expect(output.indexOf('ITEM45MARKER')).toBeLessThan(output.lastIndexOf('TOTAL'))
      const pages = pdf.internal.pages as unknown as string[][]
      const finalPage = pages[pages.length - 1].join('\n')
      expect(finalPage).toContain('Generated privately on your device')
      expect(finalPage).toMatch(/I acknowledge receipt|SEAL|Thank You/)
      expect(finalPage.length).toBeGreaterThan(500)
    })
  })
})
