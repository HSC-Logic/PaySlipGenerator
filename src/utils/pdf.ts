import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PaymentSlip } from '../types'
import { buildPaymentSlipView } from './paymentSlipView'

const safeName = (value: string) => value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Recipient'
const hexToRgb = (hex: string): [number, number, number] => { const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '0b1f3a'; return [Number.parseInt(clean.slice(0, 2), 16), Number.parseInt(clean.slice(2, 4), 16), Number.parseInt(clean.slice(4, 6), 16)] }
export const pdfFilename = (slip: PaymentSlip) => `Payment-Slip-${safeName(slip.payment.reference)}-${safeName(slip.recipient.name)}.pdf`
export function buildPdf(slip: PaymentSlip) {
  const view = buildPaymentSlipView(slip)
  const doc = new jsPDF({ unit: 'mm', format: slip.payment.paperSize || 'a4', orientation: slip.payment.orientation || 'portrait' })
  const actualWidth = doc.internal.pageSize.getWidth(); const actualHeight = doc.internal.pageSize.getHeight()
  const layoutScale = Math.min(actualWidth / 210, actualHeight / 297)
  const offsetX = (actualWidth - 210 * layoutScale) / 2; const offsetY = (actualHeight - 297 * layoutScale) / 2
  doc.saveGraphicsState(); doc.setCurrentTransformationMatrix(doc.Matrix(layoutScale, 0, 0, layoutScale, offsetX, offsetY))
  const navy: [number, number, number] = hexToRgb(view.themeColor); const muted: [number, number, number] = [91, 105, 124]
  doc.setFillColor(...navy); doc.rect(0, 0, 210, 4, 'F')
  let logoRight = 18
  if (view.company.logo) { try { doc.addImage(view.company.logo, view.company.logoFormat, 18, 14, 20, 20, undefined, 'FAST'); logoRight = 43 } catch { /* unsupported logo encoding: text remains complete */ } }
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(view.company.name, logoRight, 19, { maxWidth: 95 })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...muted); doc.text(view.company.address, logoRight, 25, { maxWidth: 95 })
  if (view.company.contacts) doc.text(view.company.contacts.replace('·', '•'), logoRight, 31, { maxWidth: 95 })
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('PAYMENT', 192, 18, { align: 'right' }); doc.setFontSize(24); doc.text('SLIP', 192, 29, { align: 'right' })
  doc.setDrawColor(215, 222, 230); doc.line(18, 40, 192, 40)
  doc.setFontSize(7); doc.setTextColor(...muted); doc.text('PAYMENT TO', 18, 49); doc.setFontSize(13); doc.setTextColor(...navy); doc.text(view.recipient.name, 18, 56, { maxWidth: 105 })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...muted)
  let y = 62; view.recipient.details.forEach(detail => { const lines = doc.splitTextToSize(detail, 100); doc.text(lines, 18, y); y += Math.max(5, lines.length * 4) })
  doc.setFontSize(7); doc.text('REFERENCE', 138, 48); doc.text('PAYMENT DATE', 138, 60); doc.text('PAYMENT METHOD', 138, 72)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy); doc.setFontSize(9); doc.text(view.payment.reference, 192, 52, { align: 'right' }); doc.text(view.payment.date, 192, 64, { align: 'right' }); doc.text(view.payment.method, 192, 76, { align: 'right' })
  doc.setFillColor(245, 247, 250); doc.roundedRect(18, 83, 174, 15, 2, 2, 'F'); doc.setFontSize(7); doc.setTextColor(...muted); doc.text('PAYMENT FOR', 23, 89); doc.setFontSize(10); doc.setTextColor(...navy); doc.text(view.payment.title, 23, 94, { maxWidth: 160 })
  autoTable(doc, { startY: 105, margin: { left: 18, right: 18 }, head: [['#', 'Description', 'Qty', 'Rate', 'Amount']], body: view.items.map(item => [item.index, item.description, item.quantity, item.rate, item.amount]), theme: 'plain', headStyles: { fillColor: navy, textColor: 255, fontSize: 8, cellPadding: 3 }, bodyStyles: { textColor: [45, 55, 68], fontSize: 8.5, cellPadding: 3, lineColor: [226, 230, 235], lineWidth: { bottom: .15 } }, columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 79 }, 2: { halign: 'right', cellWidth: 16 }, 3: { halign: 'right', cellWidth: 30 }, 4: { halign: 'right', cellWidth: 34 } } })
  const tableEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  y = tableEnd + 9
  doc.setFontSize(7); doc.setTextColor(...muted); doc.text('AMOUNT IN WORDS', 18, y); doc.setFontSize(9); doc.setTextColor(...navy); doc.text(view.totals.words, 18, y + 6, { maxWidth: 98 })
  doc.setFontSize(8); doc.setTextColor(...muted); doc.text('Subtotal', 137, y); doc.text(view.totals.subtotal, 192, y, { align: 'right' })
  if (view.totals.adjustment) { y += 7; doc.text('Adjustment', 137, y); doc.text(view.totals.adjustment, 192, y, { align: 'right' }) }
  view.totals.entries.forEach(entry => { y += 6; doc.text(entry.label, 137, y); doc.text(entry.amount, 192, y, { align: 'right' }) })
  y += 8; doc.setFillColor(...navy); doc.roundedRect(132, y - 5, 60, 13, 2, 2, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('TOTAL', 137, y + 2); doc.text(view.totals.final, 188, y + 2, { align: 'right' })
  y += 19; doc.setTextColor(...muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  if (view.payment.bankName) { doc.text(`Bank: ${view.payment.bankName}`, 18, y); y += 5 }
  if (view.payment.transactionReference) { doc.text(`Transaction / reference: ${view.payment.transactionReference}`, 18, y); y += 5 }
  if (view.payment.notes) { doc.setFont('helvetica', 'bold'); doc.text('NOTES', 18, y); doc.setFont('helvetica', 'normal'); doc.text(view.payment.notes, 18, y + 5, { maxWidth: 174 }); y += Math.max(12, doc.splitTextToSize(view.payment.notes, 174).length * 4 + 7) }
  y = Math.min(Math.max(y + 8, 226), 244); doc.setFont('helvetica', 'italic'); doc.text('I acknowledge receipt of the payment stated above.', 18, y)
  y += 23; doc.setFont('helvetica', 'normal'); doc.setDrawColor(130, 140, 152); [[18, 'Prepared By'], [78, 'Recipient Signature'], [143, 'Signature Date']].forEach(([x, label]) => { doc.line(Number(x), y, Number(x) + 46, y); doc.text(String(label), Number(x), y + 5) })
  if (view.payment.sealText) { doc.setDrawColor(...navy); doc.setTextColor(...navy); doc.setLineWidth(.6); doc.ellipse(166, 278, 25, 6); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(view.payment.sealText.toUpperCase(), 166, 280, { align: 'center', maxWidth: 43 }) }
  doc.setFillColor(245, 247, 250); doc.rect(0, 286, 210, 11, 'F'); doc.setFontSize(7); doc.setTextColor(...muted); doc.text('Generated privately on your device', 18, 292); doc.text(view.payment.rawReference, 192, 292, { align: 'right' })
  doc.restoreGraphicsState(); return doc
}

export function generatePdf(slip: PaymentSlip) { buildPdf(slip).save(pdfFilename(slip)) }
