import { useLocation, useNavigate } from 'react-router-dom'
import { saveRecovery } from '../../utils/storage'
import { createBlankSlip } from '../../utils/paymentDefaults'
import { useState } from 'react'
import type { CustomDesign, PaymentSlip } from '../../types'
import { loadCustomDesigns, parseCustomDesign, saveCustomDesigns } from '../../utils/customDesigns'

export function DesignPicker({ slip, onChange }: { slip: PaymentSlip; onChange: (slip: PaymentSlip) => void }) {
  const location = useLocation(); const navigate = useNavigate()
  const [designs, setDesigns] = useState(loadCustomDesigns)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CustomDesign>(() => slip.payment.customDesign || { name: '', layout: slip.payment.template || 'classic', color: slip.company.themeColor, font: 'helvetica' })
  const [message, setMessage] = useState('')
  const apply = (design: CustomDesign) => onChange({ ...slip, payment: { ...slip.payment, customDesign: design } })
  const update = (change: Partial<CustomDesign>) => { const next = { ...draft, ...change }; setDraft(next); if (parseCustomDesign({ ...next, name: next.name || 'Custom design' })) apply({ ...next, name: next.name || 'Custom design' }) }
  const persist = (next: CustomDesign[]) => { const error = saveCustomDesigns(next); setMessage(error); if (error) return false; setDesigns(next); return true }
  const save = () => {
    const design = parseCustomDesign(draft)
    if (!design) return setMessage('Enter a design name (up to 80 characters) and valid design settings.')
    const existing = designs.find(item => item.name.toLowerCase() === design.name.toLowerCase())
    if (existing && !window.confirm(`Replace saved design “${existing.name}”?`)) return
    const next = existing ? designs.map(item => item === existing ? design : item) : [...designs, design]
    if (persist(next)) { apply(design); setMessage(`“${design.name}” saved in this browser.`) }
  }
  return <fieldset className="template-picker"><legend>Document design</legend>
    <div>{(['classic', 'minimal', 'modern'] as const).map(layout => <label className={`template-choice ${!slip.payment.customDesign && (slip.payment.template || 'classic') === layout ? 'selected' : ''}`} key={layout}><input type="radio" name="document-template" checked={!slip.payment.customDesign && (slip.payment.template || 'classic') === layout} onChange={() => { onChange({ ...slip, payment: { ...slip.payment, template: layout, customDesign: undefined } }); setEditing(false) }} /><span className={`template-swatch swatch-${layout}`} aria-hidden="true"><i /><i /><i /></span><strong>{layout[0].toUpperCase() + layout.slice(1)}</strong></label>)}</div>
    {designs.length > 0 && <label className="custom-design-field">Saved designs<select aria-label="Saved designs" value={designs.some(design => JSON.stringify(design) === JSON.stringify(slip.payment.customDesign)) ? slip.payment.customDesign?.name : ''} onChange={event => { const design = designs.find(item => item.name === event.target.value); if (design) { setDraft(design); apply(design); setEditing(false) } }}><option value="">Choose a saved design</option>{designs.map(design => <option key={design.name}>{design.name}</option>)}</select></label>}
    <button type="button" className="button secondary" onClick={() => { const result = saveRecovery(localStorage, slip, createBlankSlip()); if (!result.success) { setMessage('Could not preserve the payment. Allow browser storage before opening the designer.'); return } navigate('/designer', {state: {slip, returnTo: location.pathname}}) }}>Open full PDF Designer</button>
    <button type="button" className="button secondary" onClick={() => { setDraft(slip.payment.customDesign || { name: '', layout: slip.payment.template || 'classic', color: slip.company.themeColor, font: 'helvetica' }); setEditing(!editing); setMessage('') }}>{editing ? 'Close designer' : 'Create or edit a design'}</button>
    {editing && <section className="custom-design-editor" aria-label="Custom design editor">
      <label>Design name<input maxLength={80} value={draft.name} onChange={event => update({ name: event.target.value })} placeholder="My company design" /></label>
      <label>Layout<select value={draft.layout} onChange={event => update({ layout: event.target.value as CustomDesign['layout'] })}>{['classic', 'minimal', 'modern'].map(layout => <option key={layout}>{layout}</option>)}</select></label>
      <label>Accent color<input type="color" value={draft.color} onChange={event => update({ color: event.target.value })} /></label>
      <label>Font<select value={draft.font} onChange={event => update({ font: event.target.value as CustomDesign['font'] })}><option value="helvetica">Sans serif</option><option value="times">Serif</option><option value="courier">Monospace</option></select></label>
      <div className="inline-actions"><button type="button" className="button primary" onClick={save}>Save design</button>{designs.some(design => design.name === draft.name) && <button type="button" className="button danger-subtle" onClick={() => { if (window.confirm(`Delete saved design “${draft.name}”?`) && persist(designs.filter(design => design.name !== draft.name))) setMessage('Saved design deleted. Current slip keeps its design.') }}>Delete saved design</button>}</div>
      <p>Changes appear in the live preview. Saved designs stay in this browser.</p>
    </section>}
    {message && <p role="status">{message}</p>}
  </fieldset>
}
