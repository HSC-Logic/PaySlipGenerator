import type { PaymentSlip } from '../../types'
import type { CSSProperties } from 'react'
import { adjustmentAmount, currencies, finalTotal, formatCurrency, itemAmount, subtotal } from '../../utils/currency'
import { numberToWords } from '../../utils/amountInWords'

const Meta = ({ label, value }: { label: string; value?: string }) => value ? <div><span>{label}</span><strong>{value}</strong></div> : null
export function PaymentSlipPreview({ slip }: { slip: PaymentSlip }) {
  const base = subtotal(slip.items)
  const total = finalTotal(slip.items, slip.payment.adjustment, slip.adjustments)
  const currency = currencies[slip.payment.currency] || currencies.LKR
  const sizes = { a4: [210, 297], a5: [148, 210], b5: [176, 250], letter: [216, 279] } as const
  const selected = sizes[slip.payment.paperSize] || sizes.a4
  const [pageWidth, pageHeight] = slip.payment.orientation === 'landscape' ? [selected[1], selected[0]] : selected
  return <article className={`slip ${slip.payment.orientation}`} id="payment-slip" aria-label="Payment slip preview" style={{ '--document-color': slip.company.themeColor || '#0b1f3a', aspectRatio: `${pageWidth} / ${pageHeight}` } as CSSProperties}>
    <div className="slip-topline" />
    <header className="slip-header">
      <div className="brand-lockup">{slip.company.logo ? <img src={slip.company.logo} alt="Company logo" /> : <div className="logo-placeholder">{slip.company.name?.slice(0, 2).toUpperCase() || 'CO'}</div>}<div><h1>{slip.company.name || 'Your Company'}</h1><p>{slip.company.address || 'Company address'}</p><p>{[slip.company.telephone, slip.company.email].filter(Boolean).join('  ·  ')}</p>{slip.company.registrationNumber && <p>Reg. No: {slip.company.registrationNumber}</p>}</div></div>
      <div className="document-title"><span>PAYMENT</span><strong>SLIP</strong></div>
    </header>
    <div className="slip-rule" />
    <section className="document-meta"><div><span>PAYMENT TO</span><h2>{slip.recipient.name || 'Recipient name'}</h2><p>{slip.recipient.role || 'Role / designation'}</p>{slip.recipient.identification && <p>NIC / ID: {slip.recipient.identification}</p>}{slip.recipient.address && <p>{slip.recipient.address}</p>}{slip.recipient.email && <p>{slip.recipient.email}</p>}{slip.recipient.telephone && <p>{slip.recipient.telephone}</p>}</div><div className="meta-grid"><Meta label="REFERENCE" value={slip.payment.reference || '—'} /><Meta label="PAYMENT DATE" value={slip.payment.date ? new Date(`${slip.payment.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} /><Meta label="PAYMENT METHOD" value={slip.payment.method} /></div></section>
    <section className="purpose"><span>PAYMENT FOR</span><strong>{slip.payment.title || 'Payment title or purpose'}</strong></section>
    <table className="slip-table"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{slip.items.map((item, i) => <tr key={item.id}><td>{String(i + 1).padStart(2, '0')}</td><td>{item.description || 'Payment item description'}</td><td>{item.quantity}</td><td>{formatCurrency(item.rate, slip.payment.currency)}</td><td>{formatCurrency(itemAmount(item), slip.payment.currency)}</td></tr>)}</tbody></table>
    <section className="totals"><div className="words"><span>AMOUNT IN WORDS</span><p>{numberToWords(Math.max(total, 0), currency.major, currency.minor)}</p></div><div className="total-lines"><div><span>Subtotal</span><strong>{formatCurrency(base, slip.payment.currency)}</strong></div>{slip.payment.adjustment !== '' && slip.payment.adjustment !== 0 && <div><span>Adjustment</span><strong>{formatCurrency(slip.payment.adjustment, slip.payment.currency)}</strong></div>}{slip.adjustments.map(entry => <div key={entry.id}><span>{entry.label}{entry.mode === 'percentage' ? ` (${entry.value || 0}%)` : ''}</span><strong>{formatCurrency(adjustmentAmount(entry, base), slip.payment.currency)}</strong></div>)}<div className="grand-total"><span>TOTAL</span><strong>{formatCurrency(total, slip.payment.currency)}</strong></div></div></section>
    {(slip.payment.bankName || slip.payment.transactionReference) && <section className="transaction"><Meta label="BANK" value={slip.payment.bankName} /><Meta label="TRANSACTION / REFERENCE" value={slip.payment.transactionReference} /></section>}
    {slip.payment.notes && <section className="notes"><span>NOTES</span><p>{slip.payment.notes}</p></section>}
    <p className="acknowledgement">I acknowledge receipt of the payment stated above.</p>
    <section className="signatures"><div><span>{slip.company.authorizedName || ''}</span><i /><strong>Prepared By</strong>{slip.company.authorizedDesignation && <small>{slip.company.authorizedDesignation}</small>}</div><div><span>&nbsp;</span><i /><strong>Recipient Signature</strong></div><div><span>&nbsp;</span><i /><strong>Signature Date</strong></div></section>
    {slip.payment.sealText && <div className="document-seal">{slip.payment.sealText}</div>}
    <footer><span>Generated privately on your device</span><strong>{slip.payment.reference}</strong></footer>
  </article>
}
