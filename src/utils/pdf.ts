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
  footerHeight: number
  contentTop: number
  contentBottom: number
  contentWidth: number
  contentHeight: number
  compact: boolean
  orientation: 'portrait' | 'landscape'
}

const safeName = (value: string) => value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Recipient'
const hexToRgb = (hex: string): [number, number, number] => { const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '0b1f3a'; return [Number.parseInt(clean.slice(0, 2), 16), Number.parseInt(clean.slice(2, 4), 16), Number.parseInt(clean.slice(4, 6), 16)] }
const addContainedLogo = (doc: jsPDF, data: string, format: 'PNG' | 'JPEG', x: number, y: number, box: number) => { const properties = doc.getImageProperties(data); const ratio = properties.width / properties.height; const width = ratio >= 1 ? box : box * ratio; const height = ratio >= 1 ? box / ratio : box; doc.addImage(data, format, x + (box - width) / 2, y + (box - height) / 2, width, height, undefined, 'FAST') }
export const pdfFilename = (slip: PaymentSlip) => `Payment-Slip-${safeName(slip.payment.reference)}-${safeName(slip.recipient.name)}.pdf`

export function getPdfPageMetrics(doc: jsPDF, orientation: PdfPageMetrics['orientation']): PdfPageMetrics {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = Math.max(12, Math.min(18, pageWidth * 0.06))
  const marginTop = Math.max(9, Math.min(12, pageHeight * 0.055))
  const marginBottom = Math.max(10, Math.min(14, pageHeight * 0.065))
  const compact = pageHeight < 180
  const footerHeight = compact ? 7 : 9
  const contentTop = marginTop
  const contentBottom = pageHeight - footerHeight - marginBottom
  return { pageWidth, pageHeight, marginX, marginTop, marginBottom, footerHeight, contentTop, contentBottom, contentWidth: pageWidth - marginX * 2, contentHeight: contentBottom - contentTop, compact, orientation }
}

const splitLines = (doc: jsPDF, value: string, width: number) => value.split(/\r?\n/).flatMap(line => line ? doc.splitTextToSize(line, width) as string[] : [''])
const lineBlockHeight = (lines: string[], lineHeight: number) => Math.max(1, lines.length) * lineHeight
export const getPdfTableColumnWidths = (contentWidth: number) => [contentWidth * 0.05, contentWidth * 0.5, contentWidth * 0.09, contentWidth * 0.17, contentWidth * 0.19]

export function buildPdf(slip: PaymentSlip) {
  const view = buildPaymentSlipView(slip)
  const orientation = slip.payment.orientation || 'portrait'
  const doc = new jsPDF({ unit: 'mm', format: slip.payment.paperSize || 'a4', orientation })
  const layout = getPdfPageMetrics(doc, orientation)
  const { pageWidth, pageHeight, marginX, contentWidth } = layout
  const landscape = orientation === 'landscape'
  const { compact, footerHeight, contentBottom } = layout
  const navy: [number, number, number] = hexToRgb(view.themeColor)
  const muted: [number, number, number] = [91, 105, 124]
  const bodySize = compact ? 6.4 : 8
  const bodyLine = compact ? 3.3 : 4.2
  const labelSize = compact ? 5.5 : 6.8
  const sectionGap = compact ? 5 : 7
  const addTopBar = () => { doc.setFillColor(...navy); doc.rect(0, 0, pageWidth, 4, 'F') }
  const addContinuationPage = (title: string) => {
    doc.addPage(slip.payment.paperSize || 'a4', orientation)
    addTopBar()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 8 : 10); doc.setTextColor(...navy); doc.text(title, marginX, layout.marginTop + 5)
    return layout.marginTop + (compact ? 15 : 19)
  }
  const ensureSpace = (y: number, height: number, title: string) => y + height <= contentBottom ? y : addContinuationPage(title)
  const drawLabel = (label: string, x: number, y: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(labelSize); doc.setTextColor(...muted); doc.text(label, x, y) }

  addTopBar()
  let y = layout.marginTop
  const companyWidth = landscape ? contentWidth * 0.56 : contentWidth * 0.67
  const logoSize = compact ? 15 : 20
  let companyX = marginX
  if (view.company.logo) { addContainedLogo(doc, view.company.logo, view.company.logoFormat, marginX, y, logoSize); companyX += logoSize + 6 }
  const companyTextWidth = companyWidth - (companyX - marginX)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 11 : 14); doc.setTextColor(...navy)
  const companyName = splitLines(doc, view.company.name, companyTextWidth); doc.text(companyName, companyX, y + 5)
  let companyY = y + 5 + lineBlockHeight(companyName, compact ? 4.2 : 5.2)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 6.2 : 7.5); doc.setTextColor(...muted)
  const companyDetails = [view.company.address, view.company.contacts.replace('·', '|'), view.company.registration].filter(Boolean).flatMap(value => splitLines(doc, value, companyTextWidth))
  if (companyDetails.length) { doc.text(companyDetails, companyX, companyY); companyY += lineBlockHeight(companyDetails, compact ? 3.1 : 3.8) }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 8 : 11); doc.setTextColor(...navy); doc.text('PAYMENT', pageWidth - marginX, y + 4, { align: 'right' }); doc.setFontSize(compact ? 17 : 24); doc.text('SLIP', pageWidth - marginX, y + (compact ? 14 : 17), { align: 'right' })
  y = Math.max(companyY, y + logoSize, y + (compact ? 18 : 24)) + sectionGap
  doc.setDrawColor(215, 222, 230); doc.line(marginX, y, pageWidth - marginX, y); y += sectionGap

  const recipientWidth = landscape ? contentWidth * 0.43 : contentWidth * 0.58
  const metaLeft = marginX + (landscape ? contentWidth * 0.5 : contentWidth * 0.65)
  const metaWidth = pageWidth - marginX - metaLeft
  drawLabel('PAYMENT TO', marginX, y)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 9 : 12); doc.setTextColor(...navy)
  const recipientName = splitLines(doc, view.recipient.name, recipientWidth); doc.text(recipientName, marginX, y + bodyLine)
  let recipientY = y + bodyLine + lineBlockHeight(recipientName, bodyLine)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(bodySize); doc.setTextColor(...muted)
  const recipientDetails = view.recipient.details.flatMap(detail => splitLines(doc, detail, recipientWidth)); if (recipientDetails.length) { doc.text(recipientDetails, marginX, recipientY); recipientY += lineBlockHeight(recipientDetails, bodyLine) }
  const meta = [['REFERENCE', view.payment.reference], ['PAYMENT DATE', view.payment.date], ['PAYMENT METHOD', view.payment.method]] as const
  let metaBottom = y
  if (landscape) {
    const columnWidth = metaWidth / 3
    meta.forEach(([label, value], index) => { const left = metaLeft + index * columnWidth; drawLabel(label, left, y); doc.setFont('helvetica', 'bold'); doc.setFontSize(bodySize); doc.setTextColor(...navy); const lines = splitLines(doc, value, columnWidth - 5); doc.text(lines, left, y + bodyLine); metaBottom = Math.max(metaBottom, y + bodyLine + lineBlockHeight(lines, bodyLine)) })
  } else {
    let metaY = y
    meta.forEach(([label, value]) => { drawLabel(label, metaLeft, metaY); doc.setFont('helvetica', 'bold'); doc.setFontSize(bodySize); doc.setTextColor(...navy); const lines = splitLines(doc, value, metaWidth); doc.text(lines, pageWidth - marginX, metaY + bodyLine, { align: 'right' }); metaY += bodyLine + lineBlockHeight(lines, bodyLine) + 2 })
    metaBottom = metaY
  }
  y = Math.max(recipientY, metaBottom) + sectionGap

  doc.setFont('helvetica', 'bold'); doc.setFontSize(bodySize); const purposeLines = splitLines(doc, view.payment.title, contentWidth - 10)
  const purposeHeight = lineBlockHeight(purposeLines, bodyLine) + (compact ? 9 : 11)
  y = ensureSpace(y, purposeHeight, 'PAYMENT DETAILS')
  doc.setFillColor(245, 247, 250); doc.roundedRect(marginX, y, contentWidth, purposeHeight, 2, 2, 'F'); drawLabel('PAYMENT FOR', marginX + 5, y + (compact ? 4 : 5)); doc.setFont('helvetica', 'bold'); doc.setFontSize(bodySize); doc.setTextColor(...navy); doc.text(purposeLines, marginX + 5, y + (compact ? 8 : 10)); y += purposeHeight + sectionGap

  const tableWidths = getPdfTableColumnWidths(contentWidth)
  autoTable(doc, { startY: y, margin: { left: marginX, right: marginX, bottom: pageHeight - contentBottom, top: layout.marginTop + 10 }, showHead: 'everyPage', rowPageBreak: 'avoid', head: [['#', 'Description', 'Qty', 'Rate', 'Amount']], body: view.items.map(item => [item.index, item.description, item.quantity, item.rate, item.amount]), theme: 'plain', headStyles: { fillColor: navy, textColor: 255, fontSize: compact ? 6.2 : 8, cellPadding: compact ? 1.6 : 3 }, bodyStyles: { textColor: [45, 55, 68], fontSize: compact ? 6.2 : 8.5, cellPadding: compact ? 1.5 : 3, lineColor: [226, 230, 235], lineWidth: { bottom: .15 } }, columnStyles: { 0: { cellWidth: tableWidths[0] }, 1: { cellWidth: tableWidths[1] }, 2: { halign: 'right', cellWidth: tableWidths[2] }, 3: { halign: 'right', cellWidth: tableWidths[3] }, 4: { halign: 'right', cellWidth: tableWidths[4] } } })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + sectionGap

  const totalsWidth = landscape ? contentWidth * 0.34 : contentWidth * 0.38
  const totalsLeft = pageWidth - marginX - totalsWidth
  const wordsWidth = contentWidth - totalsWidth - sectionGap
  const wordsLines = splitLines(doc, view.totals.words, wordsWidth)
  const totalRows = [['Subtotal', view.totals.subtotal], ...(view.totals.adjustment ? [['Adjustment', view.totals.adjustment]] : []), ...view.totals.entries.map(entry => [entry.label, entry.amount])]
  const totalLabelWidth = totalsWidth * 0.55
  const measuredRows = totalRows.map(([label, amount]) => ({ label: splitLines(doc, label, totalLabelWidth), amount }))
  const summaryHeight = Math.max(bodyLine + lineBlockHeight(wordsLines, bodyLine), measuredRows.reduce((height, row) => height + Math.max(bodyLine, lineBlockHeight(row.label, bodyLine)), 0) + (compact ? 11 : 14))
  y = ensureSpace(y, summaryHeight, 'PAYMENT SUMMARY')
  drawLabel('AMOUNT IN WORDS', marginX, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(bodySize); doc.setTextColor(...navy); doc.text(wordsLines, marginX, y + bodyLine)
  let totalsY = y
  doc.setFont('helvetica', 'normal'); doc.setFontSize(bodySize); doc.setTextColor(...muted)
  measuredRows.forEach(row => { const height = Math.max(bodyLine, lineBlockHeight(row.label, bodyLine)); doc.text(row.label, totalsLeft, totalsY); doc.text(row.amount, pageWidth - marginX, totalsY, { align: 'right' }); totalsY += height })
  const grandHeight = compact ? 9 : 12; doc.setFillColor(...navy); doc.roundedRect(totalsLeft, totalsY + 2, totalsWidth, grandHeight, 2, 2, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.text('TOTAL', totalsLeft + 5, totalsY + 2 + grandHeight * 0.65); doc.text(view.totals.final, pageWidth - marginX - 5, totalsY + 2 + grandHeight * 0.65, { align: 'right' })
  y += summaryHeight + sectionGap

  const flowSection = (label: string, value: string) => {
    if (!value) return
    let lines = splitLines(doc, value, contentWidth)
    let continued = false
    while (lines.length) {
      y = ensureSpace(y, bodyLine * 2 + 2, `${label}${continued ? ' (CONTINUED)' : ''}`)
      const capacity = Math.max(1, Math.floor((contentBottom - y - bodyLine - 2) / bodyLine))
      const pageLines = lines.slice(0, capacity); lines = lines.slice(capacity)
      drawLabel(`${label}${continued ? ' (CONTINUED)' : ''}`, marginX, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(bodySize); doc.setTextColor(...navy); doc.text(pageLines, marginX, y + bodyLine)
      y += bodyLine + lineBlockHeight(pageLines, bodyLine) + sectionGap
      if (lines.length) { y = addContinuationPage('PAYMENT SLIP - CONTINUED'); continued = true }
    }
  }
  flowSection('BANK', view.payment.bankName)
  flowSection('TRANSACTION / REFERENCE', view.payment.transactionReference)
  flowSection('NOTES', view.payment.notes)

  const signatureHeight = compact ? 30 : 38
  y = ensureSpace(y, signatureHeight, 'ACKNOWLEDGEMENT')
  const signatureStart = y
  doc.setFont('helvetica', 'italic'); doc.setFontSize(bodySize); doc.setTextColor(...muted); doc.text('I acknowledge receipt of the payment stated above.', marginX, y); y += compact ? 11 : 14
  const signatureGap = landscape ? contentWidth * 0.04 : contentWidth * 0.06
  const signatureWidth = (contentWidth - signatureGap * 2) / 3
  const signatures = [[view.company.authorizedName, 'Prepared By', view.company.authorizedDesignation], ['', 'Recipient Signature', ''], ['', 'Signature Date', '']] as const
  signatures.forEach(([name, label, designation], index) => { const left = marginX + index * (signatureWidth + signatureGap); doc.setFont('helvetica', 'normal'); doc.setFontSize(bodySize); doc.setTextColor(...navy); const nameLines = splitLines(doc, name, signatureWidth); if (name) doc.text(nameLines, left, y); const lineY = y + Math.max(bodyLine, lineBlockHeight(nameLines, bodyLine)) + 1; doc.setDrawColor(130, 140, 152); doc.line(left, lineY, left + signatureWidth, lineY); doc.setFontSize(labelSize); doc.setTextColor(...muted); doc.text(label, left, lineY + bodyLine); if (designation) doc.text(splitLines(doc, designation, signatureWidth), left, lineY + bodyLine * 2) })
  y = signatureStart + signatureHeight
  if (view.payment.sealText) {
    const sealLines = splitLines(doc, view.payment.sealText.toUpperCase(), Math.min(50, contentWidth * 0.3))
    const sealHeight = lineBlockHeight(sealLines, bodyLine) + 8; y = ensureSpace(y, sealHeight, 'SEAL')
    const sealWidth = Math.min(58, contentWidth * 0.34); const sealX = pageWidth - marginX - sealWidth / 2
    doc.setDrawColor(...navy); doc.setTextColor(...navy); doc.ellipse(sealX, y + sealHeight / 2, sealWidth / 2, sealHeight / 2); doc.setFont('helvetica', 'bold'); doc.setFontSize(bodySize); doc.text(sealLines, sealX, y + 5, { align: 'center' })
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setFillColor(245, 247, 250); doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(labelSize); doc.setTextColor(...muted); doc.text('Generated privately on your device', marginX, pageHeight - 3); const referenceLines = splitLines(doc, view.payment.rawReference, contentWidth * 0.45); doc.text(referenceLines, pageWidth - marginX, pageHeight - 3 - (referenceLines.length - 1) * bodyLine, { align: 'right' })
  }
  return doc
}

export function createPdfBlob(slip: PaymentSlip) {
  return buildPdf(slip).output('blob')
}

const pdfBlob = (doc: jsPDF) => doc.output('blob')

export async function downloadPdfDocument(doc: jsPDF, slip: PaymentSlip) {
  const url = URL.createObjectURL(pdfBlob(doc))
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = pdfFilename(slip)
    link.hidden = true
    document.body.appendChild(link)
    link.click()
    await new Promise<void>(resolve => window.setTimeout(resolve, 100))
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}

export function printPdfDocument(doc: jsPDF) {
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(pdfBlob(doc))
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
    try {
      frame.src = url
      document.body.appendChild(frame)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}

export const generatePdf = async (slip: PaymentSlip) => downloadPdfDocument(buildPdf(slip), slip)
export const printPdf = (slip: PaymentSlip) => printPdfDocument(buildPdf(slip))
