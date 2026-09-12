import { Check, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  ['Create, preview, download and print documents', true, true],
  ['Local drafts and payment history', true, true],
  ['Google Drive PDF and Google Doc saving', true, true],
  ['Cross-device cloud payment history', false, true],
  ['Multiple cloud company profiles', false, true],
  ['Unlimited cloud recipients', false, true],
  ['Custom cloud company branding', false, true],
  ['Remove “Generated with Sliply” attribution', false, true],
] as const

const Availability = ({ included }: { included: boolean }) => included ? <span className="plan-included"><Check /> Included</span> : <span className="plan-unavailable"><Minus /> Not included</span>

export function PlansPage() {
  return <main className="auth-page plans-page"><section className="auth-card plans-card"><div className="plans-heading"><span className="eyebrow">SLIPLY PLANS</span><h1>Choose what fits your workflow</h1><p>Start free. If you need Pro cloud and branding features, contact HSC Logic for manual activation—no online payment is required.</p></div>
    <div className="plans-table-wrap"><table className="plans-table"><thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead><tbody>{features.map(([feature, free, pro]) => <tr key={feature}><th scope="row">{feature}</th><td><Availability included={free} /></td><td><Availability included={pro} /></td></tr>)}</tbody></table></div>
    <div className="plan-actions"><Link className="button secondary" to="/">Continue free</Link><Link className="button secondary" to="/login">Sign in</Link><a className="button primary" href="mailto:info@hsclogic.com?subject=Sliply%20Pro%20Access%20Request">Email HSC Logic for Pro</a></div>
    <p className="plans-note">Pro access is activated manually after HSC Logic reviews your request. Existing local documents remain available if your plan changes.</p>
  </section></main>
}
