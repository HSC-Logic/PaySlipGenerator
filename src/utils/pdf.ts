import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PaymentSlip } from '../types'
import { buildPaymentSlipView } from './paymentSlipView'

type PaymentSlipView = ReturnType<typeof buildPaymentSlipView>
export type PdfPageMetrics = {
  pageWidth: number
  pageHeight: number
  marginX: number
  marginTop: number
  marginBottom: number
  contentWidth: number
  contentHeight: number
  orientation: 'portrait' | 'landscape'
}

const safeName = (value: string) => value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Recipient'
const hexToRgb = (hex: string): [number, number, number] => { const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '0b1f3a'; return [Number.parseInt(clean.slice(0, 2), 16), Number.parseInt(clean.slice(2, 4), 16), Number.parseInt(clean.slice(4, 6), 16)] }
const ellipsize = (doc: jsPDF, value: string, maxWidth: number) => { if (doc.getTextWidth(value) <= maxWidth) return value; let text = value; while (text && doc.getTextWidth(`${text}…`) > maxWidth) text = text.slice(0, -1); return `${text.trimEnd()}…` }
const limitedLines = (doc: jsPDF, value: string, maxWidth: number, maxLines: number) => { const lines = doc.splitTextToSize(value, maxWidth) as string[]; if (lines.length <= maxLines) return lines; return [...lines.slice(0, maxLines - 1), ellipsize(doc, lines.slice(maxLines - 1).join(' '), maxWidth)] }
const addContainedLogo = (doc: jsPDF, data: string, format: 'PNG' | 'JPEG', x: number, y: number, box: number) => { const properties = doc.getImageProperties(data); const ratio = properties.width / properties.height; const width = ratio >= 1 ? box : box * ratio; const height = ratio >= 1 ? box / ratio : box; doc.addImage(data, format, x + (box - width) / 2, y + (box - height) / 2, width, height, undefined, 'FAST') }
export const pdfFilename = (slip: PaymentSlip) => `Payment-Slip-${safeName(slip.payment.reference)}-${safeName(slip.recipient.name)}.pdf`

export function getPdfPageMetrics(doc: jsPDF, orientation: PdfPageMetrics['orientation']): PdfPageMetrics {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = Math.max(12, Math.min(18, pageWidth * 0.06))
  const marginTop = Math.max(9, Math.min(12, pageHeight * 0.055))
  const marginBottom = Math.max(10, Math.min(14, pageHeight * 0.065))
  return { pageWidth, pageHeight, marginX, marginTop, marginBottom, contentWidth: pageWidth - marginX * 2, contentHeight: pageHeight - marginTop - marginBottom, orientation }
}

function buildLandscapePdf(slip: PaymentSlip, view: PaymentSlipView) {
  const doc = new jsPDF({ unit: 'mm', format: slip.payment.paperSize || 'a4', orientation: 'landscape' })
  const layout = getPdfPageMetrics(doc, 'landscape')
  const { pageWidth, pageHeight, marginX, contentWidth } = layout
  const compact = pageHeight < 180
  const headerTop = layout.marginTop
  const headerBottom = headerTop + (compact ? 21 : 27)
  const metaTop = headerBottom + (compact ? 5 : 7)
  const purposeTop = metaTop + (compact ? 21 : 26)
  const tableTop = purposeTop + (compact ? 15 : 18)
  const footerHeight = compact ? 7 : 8
  const signatureY = pageHeight - footerHeight - (compact ? 15 : 18)
  const tableBottomReserve = pageHeight - signatureY + (compact ? 37 : 45)
  const companyWidth = contentWidth * 0.46
  const recipientWidth = contentWidth * 0.43
  const metaLeft = marginX + contentWidth * 0.5
  const metaWidth = contentWidth * 0.5
  const metaColumnWidth = metaWidth / 3
  const navy: [number, number, number] = hexToRgb(view.themeColor); const muted: [number, number, number] = [91, 105, 124]
  doc.setFillColor(...navy); doc.rect(0, 0, pageWidth, 4, 'F')
  let companyX = marginX
  const logoSize = compact ? 15 : 18
  if (view.company.logo) { try { addContainedLogo(doc, view.company.logo, view.company.logoFormat, marginX, headerTop, logoSize); companyX += logoSize + 6 } catch { /* keep the text header when an image cannot be decoded */ } }
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 11 : 14); const companyLines = limitedLines(doc, view.company.name, companyWidth - (companyX - marginX), compact ? 1 : 2); doc.text(companyLines, companyX, headerTop + 5)
  const companyTextBottom = headerTop + 5 + (companyLines.length - 1) * (compact ? 4 : 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 6.5 : 7.5); doc.setTextColor(...muted); doc.text(ellipsize(doc, view.company.address, companyWidth), companyX, companyTextBottom + (compact ? 4 : 5)); if (view.company.contacts) doc.text(ellipsize(doc, view.company.contacts.replace('·', '•'), companyWidth), companyX, companyTextBottom + (compact ? 8 : 10))
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 8 : 10); doc.text('PAYMENT', pageWidth - marginX, headerTop + 4, { align: 'right' }); doc.setFontSize(compact ? 17 : 22); doc.text('SLIP', pageWidth - marginX, headerTop + (compact ? 14 : 17), { align: 'right' })
  doc.setDrawColor(215, 222, 230); doc.line(marginX, headerBottom, pageWidth - marginX, headerBottom)
  doc.setFontSize(compact ? 6 : 7); doc.setTextColor(...muted); doc.text('PAYMENT TO', marginX, metaTop); doc.setFontSize(compact ? 9 : 12); doc.setTextColor(...navy); doc.text(limitedLines(doc, view.recipient.name, recipientWidth, 2), marginX, metaTop + (compact ? 6 : 7))
  doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 6 : 7.5); doc.setTextColor(...muted); const recipient = view.recipient.details.flatMap(detail => doc.splitTextToSize(detail, recipientWidth) as string[]).slice(0, compact ? 2 : 3); recipient.forEach((line, index) => doc.text(line, marginX, metaTop + (compact ? 12 : 14) + index * (compact ? 3 : 4)))
  const meta = [['REFERENCE', view.payment.reference], ['PAYMENT DATE', view.payment.date], ['PAYMENT METHOD', view.payment.method]] as const
  meta.forEach(([label, value], index) => { const left = metaLeft + index * metaColumnWidth; doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 5.5 : 6.5); doc.setTextColor(...muted); doc.text(label, left, metaTop); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 6.5 : 8); doc.setTextColor(...navy); doc.text(ellipsize(doc, value, metaColumnWidth - 5), left, metaTop + (compact ? 6 : 7)) })
  doc.setFillColor(245, 247, 250); doc.roundedRect(metaLeft, purposeTop, metaWidth, compact ? 11 : 13, 2, 2, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 5.5 : 6.5); doc.setTextColor(...muted); doc.text('PAYMENT FOR', metaLeft + 5, purposeTop + (compact ? 4 : 5)); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 6.5 : 8.5); doc.setTextColor(...navy); doc.text(ellipsize(doc, view.payment.title, metaWidth - 10), metaLeft + 5, purposeTop + (compact ? 8 : 10))
  const tableWidths = [contentWidth * 0.04, contentWidth * 0.52, contentWidth * 0.08, contentWidth * 0.16, contentWidth * 0.2]
  autoTable(doc, { startY: tableTop, margin: { left: marginX, right: marginX, bottom: tableBottomReserve, top: layout.marginTop }, showHead: 'everyPage', rowPageBreak: 'avoid', head: [['#', 'Description', 'Qty', 'Rate', 'Amount']], body: view.items.map(item => [item.index, item.description, item.quantity, item.rate, item.amount]), theme: 'plain', headStyles: { fillColor: navy, textColor: 255, fontSize: compact ? 6.2 : 7.5, cellPadding: compact ? 1.6 : 2.3 }, bodyStyles: { textColor: [45, 55, 68], fontSize: compact ? 6.2 : 7.5, cellPadding: compact ? 1.5 : 2.2, lineColor: [226, 230, 235], lineWidth: { bottom: .15 } }, columnStyles: { 0: { cellWidth: tableWidths[0] }, 1: { cellWidth: tableWidths[1] }, 2: { halign: 'right', cellWidth: tableWidths[2] }, 3: { halign: 'right', cellWidth: tableWidths[3] }, 4: { halign: 'right', cellWidth: tableWidths[4] } } })
  let cursor = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + (compact ? 5 : 7)
  const rowGap = compact ? 4 : 5
  const summaryHeight = (view.totals.adjustment ? rowGap : 0) + Math.min(view.totals.entries.length, 4) * rowGap + (compact ? 29 : 36)
  if (cursor + summaryHeight > signatureY) {
    doc.addPage(slip.payment.paperSize || 'a4', 'landscape')
    doc.setFillColor(...navy); doc.rect(0, 0, pageWidth, 4, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 8 : 10); doc.setTextColor(...navy); doc.text('PAYMENT SUMMARY', marginX, headerTop + 5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 6 : 7); doc.setTextColor(...muted); doc.text(ellipsize(doc, view.payment.reference, contentWidth * 0.35), pageWidth - marginX, headerTop + 5, { align: 'right' })
    cursor = headerTop + (compact ? 17 : 23)
  }
  const totalsLeft = marginX + contentWidth * 0.7
  const totalsRight = pageWidth - marginX
  const wordsWidth = contentWidth * 0.62
  doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 5.5 : 6.5); doc.setTextColor(...muted); doc.text('AMOUNT IN WORDS', marginX, cursor); doc.setFontSize(compact ? 6.5 : 8); doc.setTextColor(...navy); doc.text(limitedLines(doc, view.totals.words, wordsWidth, 2), marginX, cursor + (compact ? 4 : 5))
  doc.setFontSize(compact ? 6.2 : 7.5); doc.setTextColor(...muted); doc.text('Subtotal', totalsLeft, cursor); doc.text(view.totals.subtotal, totalsRight, cursor, { align: 'right' }); if (view.totals.adjustment) { cursor += rowGap; doc.text('Adjustment', totalsLeft, cursor); doc.text(view.totals.adjustment, totalsRight, cursor, { align: 'right' }) }
  view.totals.entries.slice(0, 4).forEach(entry => { cursor += rowGap; doc.text(ellipsize(doc, entry.label, contentWidth * 0.16), totalsLeft, cursor); doc.text(entry.amount, totalsRight, cursor, { align: 'right' }) })
  cursor += compact ? 6 : 7; const totalWidth = contentWidth * 0.3; doc.setFillColor(...navy); doc.roundedRect(totalsRight - totalWidth, cursor - (compact ? 3.5 : 4), totalWidth, compact ? 9 : 11, 2, 2, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 7 : 9); doc.text('TOTAL', totalsRight - totalWidth + 5, cursor + 2); doc.text(ellipsize(doc, view.totals.final, totalWidth * 0.58), totalsRight - 5, cursor + 2, { align: 'right' })
  const detailsY = cursor + (compact ? 10 : 13); const detailWidth = contentWidth / 3 - 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 5.5 : 7); doc.setTextColor(...muted); if (view.payment.bankName) doc.text(ellipsize(doc, `Bank: ${view.payment.bankName}`, detailWidth), marginX, detailsY); if (view.payment.transactionReference) doc.text(ellipsize(doc, `Transaction: ${view.payment.transactionReference}`, detailWidth), marginX + contentWidth / 3, detailsY); if (view.payment.notes) doc.text(ellipsize(doc, `Notes: ${view.payment.notes}`, detailWidth), marginX + contentWidth * 2 / 3, detailsY)
  const signatureWidth = (contentWidth - 24) / 3; doc.setDrawColor(130, 140, 152); [[marginX, 'Prepared By'], [marginX + contentWidth / 3, 'Recipient Signature'], [marginX + contentWidth * 2 / 3, 'Signature Date']].forEach(([position, label]) => { const left = Number(position); doc.line(left, signatureY, left + signatureWidth, signatureY); doc.text(String(label), left, signatureY + (compact ? 3 : 4)) })
  if (view.payment.sealText) { const sealX = pageWidth - marginX - Math.min(24, contentWidth * 0.08); doc.setDrawColor(...navy); doc.setTextColor(...navy); doc.ellipse(sealX, pageHeight - footerHeight - (compact ? 5 : 7), Math.min(22, contentWidth * 0.08), compact ? 4 : 5); doc.setFont('helvetica', 'bold'); doc.text(ellipsize(doc, view.payment.sealText.toUpperCase(), Math.min(40, contentWidth * 0.15)), sealX, pageHeight - footerHeight - (compact ? 4 : 6), { align: 'center' }) }
  doc.setFillColor(245, 247, 250); doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F'); doc.setFontSize(compact ? 5.5 : 6.5); doc.setTextColor(...muted); doc.text('Generated privately on your device', marginX, pageHeight - (compact ? 2.5 : 3)); doc.text(ellipsize(doc, view.payment.rawReference, contentWidth * 0.35), pageWidth - marginX, pageHeight - (compact ? 2.5 : 3), { align: 'right' })
  return doc
}
export function buildPdf(slip: PaymentSlip) {
  const view = buildPaymentSlipView(slip)
  if (slip.payment.orientation === 'landscape') return buildLandscapePdf(slip, view)
  const doc = new jsPDF({ unit: 'mm', format: slip.payment.paperSize || 'a4', orientation: slip.payment.orientation || 'portrait' })
  const actualWidth = doc.internal.pageSize.getWidth(); const actualHeight = doc.internal.pageSize.getHeight()
  const layoutScale = Math.min(actualWidth / 210, actualHeight / 297)
  const offsetX = (actualWidth - 210 * layoutScale) / 2; const offsetY = (actualHeight - 297 * layoutScale) / 2
  if (Math.abs(layoutScale - 1) > .001 || Math.abs(offsetX) > .001 || Math.abs(offsetY) > .001) doc.setCurrentTransformationMatrix(doc.Matrix(layoutScale, 0, 0, layoutScale, offsetX, offsetY))
  const navy: [number, number, number] = hexToRgb(view.themeColor); const muted: [number, number, number] = [91, 105, 124]
  doc.setFillColor(...navy); doc.rect(0, 0, 210, 4, 'F')
  let logoRight = 18
  if (view.company.logo) { try { addContainedLogo(doc, view.company.logo, view.company.logoFormat, 18, 14, 20); logoRight = 43 } catch { /* unsupported logo encoding: text remains complete */ } }
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(limitedLines(doc, view.company.name, 92, 2), logoRight, 18)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...muted); doc.text(limitedLines(doc, view.company.address, 92, 2), logoRight, 27)
  if (view.company.contacts) doc.text(ellipsize(doc, view.company.contacts.replace('·', '•'), 92), logoRight, 35)
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('PAYMENT', 192, 18, { align: 'right' }); doc.setFontSize(24); doc.text('SLIP', 192, 29, { align: 'right' })
  doc.setDrawColor(215, 222, 230); doc.line(18, 40, 192, 40)
  doc.setFontSize(7); doc.setTextColor(...muted); doc.text('PAYMENT TO', 18, 49); doc.setFontSize(12); doc.setTextColor(...navy); doc.text(limitedLines(doc, view.recipient.name, 105, 2), 18, 56)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...muted)
  let y = 66; const recipientLines = view.recipient.details.flatMap(detail => doc.splitTextToSize(detail, 100) as string[]).slice(0, 3); recipientLines.forEach(line => { doc.text(line, 18, y); y += 4 })
  doc.setFontSize(7); doc.text('REFERENCE', 138, 48); doc.text('PAYMENT DATE', 138, 60); doc.text('PAYMENT METHOD', 138, 72)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy); doc.setFontSize(9); doc.text(ellipsize(doc, view.payment.reference, 50), 192, 52, { align: 'right' }); doc.text(view.payment.date, 192, 64, { align: 'right' }); doc.text(ellipsize(doc, view.payment.method, 50), 192, 76, { align: 'right' })
  doc.setFillColor(245, 247, 250); doc.roundedRect(18, 83, 174, 15, 2, 2, 'F'); doc.setFontSize(7); doc.setTextColor(...muted); doc.text('PAYMENT FOR', 23, 89); doc.setFontSize(10); doc.setTextColor(...navy); doc.text(ellipsize(doc, view.payment.title, 160), 23, 94)
  autoTable(doc, { startY: 105, margin: { left: 18, right: 18, bottom: 102 }, showHead: 'everyPage', rowPageBreak: 'avoid', head: [['#', 'Description', 'Qty', 'Rate', 'Amount']], body: view.items.map(item => [item.index, item.description, item.quantity, item.rate, item.amount]), theme: 'plain', headStyles: { fillColor: navy, textColor: 255, fontSize: 8, cellPadding: 3 }, bodyStyles: { textColor: [45, 55, 68], fontSize: 8.5, cellPadding: 3, lineColor: [226, 230, 235], lineWidth: { bottom: .15 } }, columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 79 }, 2: { halign: 'right', cellWidth: 16 }, 3: { halign: 'right', cellWidth: 30 }, 4: { halign: 'right', cellWidth: 34 } } })
  const tableEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  y = tableEnd + 9
  doc.setFontSize(7); doc.setTextColor(...muted); doc.text('AMOUNT IN WORDS', 18, y); doc.setFontSize(9); doc.setTextColor(...navy); doc.text(view.totals.words, 18, y + 6, { maxWidth: 98 })
  doc.setFontSize(8); doc.setTextColor(...muted); doc.text('Subtotal', 137, y); doc.text(view.totals.subtotal, 192, y, { align: 'right' })
  if (view.totals.adjustment) { y += 7; doc.text('Adjustment', 137, y); doc.text(view.totals.adjustment, 192, y, { align: 'right' }) }
  view.totals.entries.forEach(entry => { y += 6; doc.text(entry.label, 137, y); doc.text(entry.amount, 192, y, { align: 'right' }) })
  y += 8; doc.setFillColor(...navy); doc.roundedRect(132, y - 5, 60, 13, 2, 2, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('TOTAL', 137, y + 2); doc.text(ellipsize(doc, view.totals.final, 43), 188, y + 2, { align: 'right' })
  y += 19; doc.setTextColor(...muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  if (view.payment.bankName) { doc.text(`Bank: ${view.payment.bankName}`, 18, y); y += 5 }
  if (view.payment.transactionReference) { doc.text(`Transaction / reference: ${view.payment.transactionReference}`, 18, y); y += 5 }
  if (view.payment.notes) { doc.setFont('helvetica', 'bold'); doc.text('NOTES', 18, y); doc.setFont('helvetica', 'normal'); const noteLines = limitedLines(doc, view.payment.notes, 174, Math.max(1, Math.floor((225 - y) / 4))); doc.text(noteLines, 18, y + 5); y += Math.max(12, noteLines.length * 4 + 7) }
  y = Math.min(Math.max(y + 8, 226), 244); doc.setFont('helvetica', 'italic'); doc.text('I acknowledge receipt of the payment stated above.', 18, y)
  y += 23; doc.setFont('helvetica', 'normal'); doc.setDrawColor(130, 140, 152); [[18, 'Prepared By'], [78, 'Recipient Signature'], [143, 'Signature Date']].forEach(([x, label]) => { doc.line(Number(x), y, Number(x) + 46, y); doc.text(String(label), Number(x), y + 5) })
  if (view.payment.sealText) { doc.setDrawColor(...navy); doc.setTextColor(...navy); doc.setLineWidth(.6); doc.ellipse(166, 278, 25, 6); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(view.payment.sealText.toUpperCase(), 166, 280, { align: 'center', maxWidth: 43 }) }
  doc.setFillColor(245, 247, 250); doc.rect(0, 286, 210, 11, 'F'); doc.setFontSize(7); doc.setTextColor(...muted); doc.text('Generated privately on your device', 18, 292); doc.text(view.payment.rawReference, 192, 292, { align: 'right' })
  return doc
}

export function createPdfBlob(slip: PaymentSlip) {
  return buildPdf(slip).output('blob')
}

export function generatePdf(slip: PaymentSlip) {
  const url = URL.createObjectURL(createPdfBlob(slip))
  const link = document.createElement('a')
  link.href = url
  link.download = pdfFilename(slip)
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function printPdf(slip: PaymentSlip) {
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(createPdfBlob(slip))
    const frame = document.createElement('iframe')
    let cleaned = false
    let fallbackTimer = 0

    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      window.clearTimeout(fallbackTimer)
      frame.remove()
      URL.revokeObjectURL(url)
    }

    frame.title = 'Printable payment slip PDF'
    frame.setAttribute('aria-hidden', 'true')
    Object.assign(frame.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '1px',
      height: '1px',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
    })
    frame.onload = () => {
      try {
        const printableWindow = frame.contentWindow
        if (!printableWindow) throw new Error('The printable PDF could not be opened.')
        printableWindow.addEventListener('afterprint', () => window.setTimeout(cleanup, 500), { once: true })
        fallbackTimer = window.setTimeout(cleanup, 5 * 60_000)
        printableWindow.focus()
        printableWindow.print()
        resolve()
      } catch (error) {
        cleanup()
        reject(error)
      }
    }
    frame.onerror = () => {
      cleanup()
      reject(new Error('The printable PDF could not be loaded. Download it and print from your PDF viewer instead.'))
    }
    frame.src = url
    document.body.appendChild(frame)
  })
}
