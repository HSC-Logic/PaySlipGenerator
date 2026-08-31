import type { PaymentSlip } from '../types'
import { adjustmentAmount, currencies, finalTotal, formatCurrency, itemAmount, subtotal } from './currency'
import { numberToWords } from './amountInWords'

export const paperSizes = { a4: [210, 297], a5: [148, 210], b5: [176, 250], letter: [216, 279] } as const

export const formatPaymentDate = (date: string) => date && !Number.isNaN(Date.parse(`${date}T00:00:00`))
  ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

export const formatPaymentReference = (reference: string) => reference.trim() || '—'

export function buildPaymentSlipView(slip: PaymentSlip) {
  const base = subtotal(slip.items)
  const total = finalTotal(slip.items, slip.payment.adjustment, slip.adjustments)
  const currency = currencies[slip.payment.currency] || currencies.LKR
  const selectedSize = paperSizes[slip.payment.paperSize] || paperSizes.a4
  const [pageWidth, pageHeight] = slip.payment.orientation === 'landscape' ? [selectedSize[1], selectedSize[0]] : selectedSize
  const recipientDetails = [
    slip.recipient.role || 'Role / designation',
    slip.recipient.identification ? `NIC / ID: ${slip.recipient.identification}` : '',
    slip.recipient.address,
    slip.recipient.email,
    slip.recipient.telephone,
  ].filter(Boolean)

  return {
    company: {
      name: slip.company.name || 'Your Company', address: slip.company.address || 'Company address',
      contacts: [slip.company.telephone, slip.company.email].filter(Boolean).join('  ·  '), registration: slip.company.registrationNumber ? `Reg. No: ${slip.company.registrationNumber}` : '',
      logo: slip.company.logo, logoFormat: /^data:image\/jpe?g/i.test(slip.company.logo) ? 'JPEG' as const : 'PNG' as const, initials: slip.company.name?.slice(0, 2).toUpperCase() || 'CO', authorizedName: slip.company.authorizedName, authorizedDesignation: slip.company.authorizedDesignation,
    },
    recipient: { name: slip.recipient.name || 'Recipient name', role: slip.recipient.role, details: recipientDetails },
    payment: {
      reference: formatPaymentReference(slip.payment.reference), rawReference: slip.payment.reference, date: formatPaymentDate(slip.payment.date), rawDate: slip.payment.date,
      method: slip.payment.method, title: slip.payment.title || 'Payment title or purpose', bankName: slip.payment.bankName,
      transactionReference: slip.payment.transactionReference, notes: slip.payment.notes, sealText: slip.payment.sealText,
      currency: slip.payment.currency, paperSize: slip.payment.paperSize, orientation: slip.payment.orientation,
    },
    items: slip.items.map((item, index) => ({
      id: item.id, index: String(index + 1).padStart(2, '0'), description: item.description || 'Payment item description',
      quantity: String(item.quantity), rate: formatCurrency(item.rate, slip.payment.currency), amount: formatCurrency(itemAmount(item), slip.payment.currency),
    })),
    totals: {
      base, total, subtotal: formatCurrency(base, slip.payment.currency), final: formatCurrency(total, slip.payment.currency),
      adjustment: slip.payment.adjustment !== '' && slip.payment.adjustment !== 0 ? formatCurrency(slip.payment.adjustment, slip.payment.currency) : '',
      entries: slip.adjustments.map(entry => ({ id: entry.id, label: `${entry.label}${entry.mode === 'percentage' ? ` (${entry.value || 0}%)` : ''}`, amount: formatCurrency(adjustmentAmount(entry, base), slip.payment.currency) })),
      words: numberToWords(Math.max(total, 0), currency.major, currency.minor),
    },
    page: { width: pageWidth, height: pageHeight },
    themeColor: slip.company.themeColor || '#0b1f3a',
  }
}
