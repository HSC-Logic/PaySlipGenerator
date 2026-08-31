import { Building2, Contact, CreditCard, FileText, LayoutTemplate, Palette, Plus, RefreshCw, Save, Trash2, Upload } from 'lucide-react'
import type { ChangeEvent } from 'react'
import type { Errors, PaymentSlip, WorkflowStep } from '../../types'
import { currencies, formatCurrency, itemAmount } from '../../utils/currency'
import { Field, Input, TextArea } from '../common/Field'

interface Props { slip: PaymentSlip; errors: Errors; step: Exclude<WorkflowStep, 'review'>; onChange: (next: PaymentSlip) => void; onReference: () => void; onSaveCompany: () => void; onLogoError: (message: string) => void }
const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => <section className="form-section"><h2>{icon}{title}</h2>{children}</section>

export function SlipForm({ slip, errors, step, onChange, onReference, onSaveCompany, onLogoError }: Props) {
  const set = (group: 'company' | 'recipient' | 'payment', key: string, value: string | number) => onChange({ ...slip, [group]: { ...slip[group], [key]: value } })
  const numericValue = (value: string) => value === '' ? '' : Number(value)
  const logo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    if (!file.type.startsWith('image/')) return onLogoError('Please select an image file.')
    if (file.size > 2 * 1024 * 1024) return onLogoError('Logo must be smaller than 2 MB.')
    const reader = new FileReader(); reader.onload = () => set('company', 'logo', String(reader.result)); reader.readAsDataURL(file)
  }
  const setItem = (i: number, key: string, value: string | number) => onChange({ ...slip, items: slip.items.map((item, index) => index === i ? { ...item, [key]: value } : item) })
  const setAdjustment = (i: number, key: string, value: string | number) => onChange({ ...slip, adjustments: slip.adjustments.map((entry, index) => index === i ? { ...entry, [key]: value } : entry) })
  const setAdjustmentKind = (i: number, kind: string) => { const labels: Record<string, string> = { discount: 'Discount', tax: 'Tax / VAT', service: 'Service charge', delivery: 'Delivery charge', charge: 'Other charge' }; onChange({ ...slip, adjustments: slip.adjustments.map((entry, index) => index === i ? { ...entry, kind: kind as typeof entry.kind, label: labels[kind] } : entry) }) }
  return <form className="editor" onSubmit={e => e.preventDefault()} noValidate aria-label={`${step} step`}>
    {step === 'company' && <>
    <Section icon={<Building2 />} title="Company information">
      <div className="field-grid"><Field label="Company name *" error={errors['company.name']}><Input value={slip.company.name} onChange={e => set('company', 'name', e.target.value)} /></Field><Field label="Registration number"><Input value={slip.company.registrationNumber} onChange={e => set('company', 'registrationNumber', e.target.value)} /></Field></div>
      <Field label="Company address *" error={errors['company.address']}><TextArea value={slip.company.address} onChange={e => set('company', 'address', e.target.value)} /></Field>
      <div className="field-grid"><Field label="Telephone"><Input type="tel" value={slip.company.telephone} onChange={e => set('company', 'telephone', e.target.value)} /></Field><Field label="Email" error={errors['company.email']}><Input type="email" value={slip.company.email} onChange={e => set('company', 'email', e.target.value)} /></Field></div>
      <div className="field-grid"><Field label="Authorized person"><Input value={slip.company.authorizedName} onChange={e => set('company', 'authorizedName', e.target.value)} /></Field><Field label="Designation"><Input value={slip.company.authorizedDesignation} onChange={e => set('company', 'authorizedDesignation', e.target.value)} /></Field></div>
      <Field label="Company theme color" error={errors['company.themeColor']} hint="Used for headings, totals, borders, and the optional seal."><div className="color-control"><Input type="color" value={/^#[0-9a-f]{6}$/i.test(slip.company.themeColor) ? slip.company.themeColor : '#0b1f3a'} onChange={e => set('company', 'themeColor', e.target.value)} aria-label="Choose company theme color" /><Input value={slip.company.themeColor} pattern="#[0-9A-Fa-f]{6}" maxLength={7} onChange={e => set('company', 'themeColor', e.target.value)} aria-label="Company theme color hex value" /><Palette /></div></Field>
      <div className="inline-actions"><label className="button secondary file-button"><Upload /> Upload logo<input type="file" accept="image/*" onChange={logo} /></label>{slip.company.logo && <button className="text-button" onClick={() => set('company', 'logo', '')}>Remove logo</button>}<button className="button secondary push" onClick={onSaveCompany}><Save /> Save company</button></div>
    </Section>
    </>}
    {step === 'recipient' && <>
    <Section icon={<Contact />} title="Recipient information">
      <div className="field-grid"><Field label="Full name *" error={errors['recipient.name']}><Input value={slip.recipient.name} onChange={e => set('recipient', 'name', e.target.value)} /></Field><Field label="NIC / identification"><Input value={slip.recipient.identification} onChange={e => set('recipient', 'identification', e.target.value)} /></Field></div>
      <div className="field-grid"><Field label="Role / designation *" error={errors['recipient.role']}><Input value={slip.recipient.role} onChange={e => set('recipient', 'role', e.target.value)} /></Field><Field label="Telephone"><Input type="tel" value={slip.recipient.telephone} onChange={e => set('recipient', 'telephone', e.target.value)} /></Field></div>
      <Field label="Address"><TextArea value={slip.recipient.address} onChange={e => set('recipient', 'address', e.target.value)} /></Field>
      <Field label="Email address" error={errors['recipient.email']}><Input type="email" value={slip.recipient.email} onChange={e => set('recipient', 'email', e.target.value)} /></Field>
    </Section>
    </>}
    {step === 'payment' && <>
    <Section icon={<LayoutTemplate />} title="Document settings">
      <p className="section-description">Choose the physical page format used by the live preview, PDF download, and printing.</p>
      <div className="field-grid"><Field label="Paper size"><select value={slip.payment.paperSize} onChange={e => set('payment', 'paperSize', e.target.value)}><option value="a4">A4 — 210 × 297 mm</option><option value="a5">A5 — 148 × 210 mm</option><option value="b5">B5 — 176 × 250 mm</option><option value="letter">Letter — 8.5 × 11 in</option></select></Field><Field label="Orientation"><select value={slip.payment.orientation} onChange={e => set('payment', 'orientation', e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></Field></div>
    </Section>
    <Section icon={<CreditCard />} title="Payment details">
      <div className="field-grid"><Field label="Payment date *" error={errors['payment.date']}><Input type="date" value={slip.payment.date} onChange={e => set('payment', 'date', e.target.value)} /></Field><Field label="Payment reference *" error={errors['payment.reference']}><div className="input-action"><Input value={slip.payment.reference} onChange={e => set('payment', 'reference', e.target.value)} /><button title="Generate reference" onClick={onReference}><RefreshCw /></button></div></Field></div>
      <Field label="Payment title / purpose *" error={errors['payment.title']}><Input value={slip.payment.title} onChange={e => set('payment', 'title', e.target.value)} /></Field>
      <div className="field-grid"><Field label="Currency"><select value={slip.payment.currency} onChange={e => set('payment', 'currency', e.target.value)}>{Object.entries(currencies).map(([code, config]) => <option key={code} value={code}>{code} — {config.symbol}</option>)}</select></Field><Field label="Payment method"><select value={slip.payment.method} onChange={e => set('payment', 'method', e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Other</option></select></Field></div>
      <Field label="Bank name"><Input value={slip.payment.bankName} onChange={e => set('payment', 'bankName', e.target.value)} /></Field>
      <Field label="Bank / transaction reference"><Input value={slip.payment.transactionReference} onChange={e => set('payment', 'transactionReference', e.target.value)} /></Field>
    </Section>
    <Section icon={<FileText />} title="Description and amount">
      {errors.items && <p className="error panel-error" role="alert">{errors.items}</p>}
      <div className="item-list">{slip.items.map((item, i) => <div className="item-card" key={item.id}><div className="item-number">{String(i + 1).padStart(2, '0')}</div><Field label="Description" error={errors[`items.${i}.description`]}><Input value={item.description} onChange={e => setItem(i, 'description', e.target.value)} /></Field><Field label="Qty" error={errors[`items.${i}.quantity`]}><Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => setItem(i, 'quantity', numericValue(e.target.value))} /></Field><Field label="Rate" error={errors[`items.${i}.rate`]}><Input type="number" min="0" step="0.01" value={item.rate} onChange={e => setItem(i, 'rate', numericValue(e.target.value))} /></Field><div className="item-total"><span>Amount</span><strong>{formatCurrency(itemAmount(item), slip.payment.currency)}</strong></div><button className="icon-danger" title={`Remove item ${i + 1}`} disabled={slip.items.length === 1} onClick={() => onChange({ ...slip, items: slip.items.filter((_, x) => x !== i) })}><Trash2 /></button></div>)}</div>
      <button className="button secondary" onClick={() => onChange({ ...slip, items: [...slip.items, { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0 }] })}><Plus /> Add item</button>
      <div className="field-grid spaced"><Field label="Adjustment / deduction" error={errors.adjustment} hint="Use a negative value for a deduction."><Input type="number" step="0.01" value={slip.payment.adjustment} onChange={e => set('payment', 'adjustment', numericValue(e.target.value))} /></Field><Field label="Notes"><TextArea value={slip.payment.notes} onChange={e => set('payment', 'notes', e.target.value)} /></Field></div>
      <div className="adjustments-heading"><div><strong>Discounts, taxes & charges</strong><span>Add fixed or percentage-based adjustments.</span></div><button className="button secondary" onClick={() => onChange({ ...slip, adjustments: [...slip.adjustments, { id: crypto.randomUUID(), label: 'Discount', kind: 'discount', mode: 'percentage', value: 0 }] })}><Plus /> Add adjustment</button></div>
      <div className="adjustment-list">{slip.adjustments.map((entry, i) => <div className="adjustment-row" key={entry.id}><Field label="Type"><select value={entry.kind} onChange={e => setAdjustmentKind(i, e.target.value)}><option value="discount">Discount</option><option value="tax">Tax / VAT</option><option value="service">Service charge</option><option value="delivery">Delivery charge</option><option value="charge">Other charge</option></select></Field><Field label="Label" error={errors[`adjustments.${i}.label`]}><Input value={entry.label} onChange={e => setAdjustment(i, 'label', e.target.value)} /></Field><Field label="Calculation"><select value={entry.mode} onChange={e => setAdjustment(i, 'mode', e.target.value)}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount</option></select></Field><Field label={entry.mode === 'percentage' ? 'Percent' : 'Amount'} error={errors[`adjustments.${i}.value`]}><Input type="number" min="0" step="0.01" value={entry.value} onChange={e => setAdjustment(i, 'value', numericValue(e.target.value))} /></Field><button className="icon-danger adjustment-remove" title={`Remove ${entry.label}`} onClick={() => onChange({ ...slip, adjustments: slip.adjustments.filter((_, x) => x !== i) })}><Trash2 /></button></div>)}</div>
      <Field label="Bottom seal / message" hint="Optional. Leave blank to hide it."><Input list="seal-options" maxLength={28} placeholder="e.g. Thank You" value={slip.payment.sealText} onChange={e => set('payment', 'sealText', e.target.value)} /><datalist id="seal-options"><option value="Thank You" /><option value="Paid" /><option value="Received" /><option value="Payment Complete" /></datalist></Field>
    </Section>
    </>}
  </form>
}
