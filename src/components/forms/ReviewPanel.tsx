import { AlertCircle, Building2, CheckCircle2, Contact, CreditCard, FileText } from 'lucide-react'
import type { Errors, PaymentSlip } from '../../types'
import { buildPaymentSlipView } from '../../utils/paymentSlipView'

const Summary = ({ icon, title, primary, secondary }: { icon: React.ReactNode; title: string; primary: string; secondary: string }) => <div className="review-summary"><span>{icon}</span><div><small>{title}</small><strong>{primary || 'Not provided'}</strong><p>{secondary}</p></div></div>

export function ReviewPanel({ slip, errors }: { slip: PaymentSlip; errors: Errors }) {
  const errorCount = Object.keys(errors).length
  const view = buildPaymentSlipView(slip)
  return <section className="form-section review-panel" aria-labelledby="review-title"><div className="review-heading"><div className="review-icon"><FileText /></div><div><h2 id="review-title">Review your payment slip</h2><p>Check the summary and live document before printing or downloading.</p></div></div>
    <div className={`review-status ${errorCount ? 'needs-attention' : 'ready'}`}>{errorCount ? <AlertCircle /> : <CheckCircle2 />}<div><strong>{errorCount ? `${errorCount} item${errorCount === 1 ? '' : 's'} need attention` : 'Ready to generate'}</strong><span>{errorCount ? 'Use the workflow steps above to correct the information.' : 'All required information is complete.'}</span></div></div>
    <div className="review-grid"><Summary icon={<Building2 />} title="COMPANY" primary={view.company.name} secondary={view.company.address} /><Summary icon={<Contact />} title="RECIPIENT" primary={view.recipient.name} secondary={view.recipient.role} /><Summary icon={<CreditCard />} title="PAYMENT" primary={view.payment.title} secondary={`${view.payment.reference} · ${view.payment.date}`} /><Summary icon={<FileText />} title="DOCUMENT" primary={`${view.payment.paperSize.toUpperCase()} · ${view.payment.orientation}`} secondary={`${view.items.length} line item${view.items.length === 1 ? '' : 's'} · ${view.totals.final}`} /></div>
    {errorCount > 0 && <div className="review-errors"><strong>Please complete:</strong><ul>{Object.values(errors).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul></div>}
    <p className="review-hint">Use the preview alongside this summary to confirm wrapping, totals, company color, seal, and signature areas.</p>
  </section>
}
