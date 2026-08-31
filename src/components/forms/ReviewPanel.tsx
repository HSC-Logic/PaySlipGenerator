import { AlertCircle, Building2, CheckCircle2, Contact, CreditCard, FileText } from 'lucide-react'
import type { Errors, PaymentSlip } from '../../types'
import { finalTotal, formatCurrency } from '../../utils/currency'

const Summary = ({ icon, title, primary, secondary }: { icon: React.ReactNode; title: string; primary: string; secondary: string }) => <div className="review-summary"><span>{icon}</span><div><small>{title}</small><strong>{primary || 'Not provided'}</strong><p>{secondary}</p></div></div>

export function ReviewPanel({ slip, errors }: { slip: PaymentSlip; errors: Errors }) {
  const errorCount = Object.keys(errors).length
  return <section className="form-section review-panel" aria-labelledby="review-title"><div className="review-heading"><div className="review-icon"><FileText /></div><div><h2 id="review-title">Review your payment slip</h2><p>Check the summary and live document before printing or downloading.</p></div></div>
    <div className={`review-status ${errorCount ? 'needs-attention' : 'ready'}`}>{errorCount ? <AlertCircle /> : <CheckCircle2 />}<div><strong>{errorCount ? `${errorCount} item${errorCount === 1 ? '' : 's'} need attention` : 'Ready to generate'}</strong><span>{errorCount ? 'Use the workflow steps above to correct the information.' : 'All required information is complete.'}</span></div></div>
    <div className="review-grid"><Summary icon={<Building2 />} title="COMPANY" primary={slip.company.name} secondary={slip.company.address} /><Summary icon={<Contact />} title="RECIPIENT" primary={slip.recipient.name} secondary={slip.recipient.role} /><Summary icon={<CreditCard />} title="PAYMENT" primary={slip.payment.title} secondary={`${slip.payment.reference || 'No reference'} · ${slip.payment.date || 'No date'}`} /><Summary icon={<FileText />} title="DOCUMENT" primary={`${slip.payment.paperSize.toUpperCase()} · ${slip.payment.orientation}`} secondary={`${slip.items.length} line item${slip.items.length === 1 ? '' : 's'} · ${formatCurrency(finalTotal(slip.items, slip.payment.adjustment, slip.adjustments), slip.payment.currency)}`} /></div>
    {errorCount > 0 && <div className="review-errors"><strong>Please complete:</strong><ul>{Object.values(errors).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul></div>}
    <p className="review-hint">Use the preview alongside this summary to confirm wrapping, totals, company color, seal, and signature areas.</p>
  </section>
}
