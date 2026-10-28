import { Check, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandHeader, DeveloperMark } from '../common/BrandHeader'

const features = [
  ['Create, preview, download and print documents', true, true],
  ['Everything in the browser, no limits: drafts, history, companies and recipients stay on your device', true, true],
  ['Cloud sync of payments, companies and recipients across devices', false, true],
  ['Google Drive PDF and Google Doc saving', false, true],
  ['Remove “Generated with Sliply” attribution', false, true],
] as const

const Availability = ({ included }: { included: boolean }) => included ? <span className="plan-included"><Check /> Included</span> : <span className="plan-unavailable"><Minus /> Not included</span>

export function PlansPage() {
  return <main className="auth-page plans-page"><BrandHeader /><section className="auth-card plans-card"><div className="plans-heading"><h1>Choose what fits your workflow</h1><p>Start free: everything in the browser, with no limits. Pro adds cloud sync, Google Drive and attribution removal. Contact HSC Logic for manual activation—no online payment is required.</p></div>
    <div className="plans-table-wrap"><table className="plans-table"><thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead><tbody>{features.map(([feature, free, pro]) => <tr key={feature}><th scope="row">{feature}</th><td><Availability included={free} /></td><td><Availability included={pro} /></td></tr>)}</tbody></table></div>
    <div className="plan-actions"><Link className="button secondary" to="/guest">Continue free</Link><Link className="button secondary" to="/login">Sign in</Link><a className="button primary" href="mailto:info@hsclogic.com?subject=Sliply%20Pro%20Access%20Request">Email HSC Logic for Pro</a></div>
    <p className="plans-note">Pro access is activated manually after HSC Logic reviews your request. Your documents in this browser stay available whatever your plan. If Pro ends, your cloud data is kept for 14 days, then archived for 24 months; you can download it from account settings.</p>
  </section><DeveloperMark /></main>
}
