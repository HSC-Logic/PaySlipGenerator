import { useMemo, type CSSProperties } from 'react'
import type { PaymentSlip } from '../../types'
import { buildPaymentSlipView } from '../../utils/paymentSlipView'

const Meta = ({ label, value }: { label: string; value?: string }) => value ? <div><span>{label}</span><strong>{value}</strong></div> : null

export function PaymentSlipPreview({ slip }: { slip: PaymentSlip }) {
  const view = useMemo(() => buildPaymentSlipView(slip), [slip])
  return <article className={`slip ${view.payment.orientation}`} id="payment-slip" aria-label="Payment slip preview" style={{ '--document-color': view.themeColor, aspectRatio: `${view.page.width} / ${view.page.height}` } as CSSProperties}>
    <div className="slip-topline" />
    <header className="slip-header">
      <div className="brand-lockup">{view.company.logo ? <img src={view.company.logo} alt="Company logo" /> : <div className="logo-placeholder">{view.company.initials}</div>}<div><h1>{view.company.name}</h1><p>{view.company.address}</p>{view.company.contacts && <p>{view.company.contacts}</p>}{view.company.registration && <p>{view.company.registration}</p>}</div></div>
      <div className="document-title"><span>PAYMENT</span><strong>SLIP</strong></div>
    </header>
    <div className="slip-rule" />
    <section className="document-meta"><div><span>PAYMENT TO</span><h2>{view.recipient.name}</h2>{view.recipient.details.map(detail => <p key={detail}>{detail}</p>)}</div><div className="meta-grid"><Meta label="REFERENCE" value={view.payment.reference} /><Meta label="PAYMENT DATE" value={view.payment.date} /><Meta label="PAYMENT METHOD" value={view.payment.method} /></div></section>
    <section className="purpose"><span>PAYMENT FOR</span><strong>{view.payment.title}</strong></section>
    <table className="slip-table"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{view.items.map(item => <tr key={item.id}><td>{item.index}</td><td>{item.description}</td><td>{item.quantity}</td><td>{item.rate}</td><td>{item.amount}</td></tr>)}</tbody></table>
    <section className="totals"><div className="words"><span>AMOUNT IN WORDS</span><p>{view.totals.words}</p></div><div className="total-lines"><div><span>Subtotal</span><strong>{view.totals.subtotal}</strong></div>{view.totals.adjustment && <div><span>Adjustment</span><strong>{view.totals.adjustment}</strong></div>}{view.totals.entries.map(entry => <div key={entry.id}><span>{entry.label}</span><strong>{entry.amount}</strong></div>)}<div className="grand-total"><span>TOTAL</span><strong>{view.totals.final}</strong></div></div></section>
    {(view.payment.bankName || view.payment.transactionReference) && <section className="transaction"><Meta label="BANK" value={view.payment.bankName} /><Meta label="TRANSACTION / REFERENCE" value={view.payment.transactionReference} /></section>}
    {view.payment.notes && <section className="notes"><span>NOTES</span><p>{view.payment.notes}</p></section>}
    <p className="acknowledgement">I acknowledge receipt of the payment stated above.</p>
    <section className="signatures"><div><span>{view.company.authorizedName}</span><i /><strong>Prepared By</strong>{view.company.authorizedDesignation && <small>{view.company.authorizedDesignation}</small>}</div><div><span>&nbsp;</span><i /><strong>Recipient Signature</strong></div><div><span>&nbsp;</span><i /><strong>Signature Date</strong></div></section>
    {view.payment.sealText && <div className="document-seal">{view.payment.sealText}</div>}
    <footer><span className="sliply-attribution">Generated with Sliply</span><strong>{view.payment.rawReference}</strong></footer>
  </article>
}
