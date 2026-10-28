import { Save, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { AppSettings, CurrencyCode } from '../../types'
import { currencies } from '../../utils/currency'

export function SettingsPanel({ settings, onSave, attribution }: { settings: AppSettings; onSave: (settings: AppSettings) => void; attribution?: { show: boolean; allowed: boolean; onChange: (show: boolean) => void } }) {
  const [draft, setDraft] = useState(settings)
  useEffect(() => setDraft(settings), [settings])
  return <section className="settings-panel" aria-label="Settings"><div className="tool-panel-heading"><Settings /> Settings</div><div className="settings-fields"><label><span>Default currency</span><select value={draft.defaultCurrency} onChange={event => setDraft({ ...draft, defaultCurrency: event.target.value as CurrencyCode })}>{Object.entries(currencies).map(([code, currency]) => <option value={code} key={code}>{code} — {currency.symbol}</option>)}</select></label><label><span>Reference prefix</span><input value={draft.referencePrefix} maxLength={12} onChange={event => setDraft({ ...draft, referencePrefix: event.target.value })} aria-describedby="reference-prefix-hint" /><small id="reference-prefix-hint">Letters, numbers and single hyphens. Used for future references only.</small></label><button type="button" className="button secondary" onClick={() => onSave(draft)}><Save /> Save settings</button>{attribution && <label><input type="checkbox" checked={attribution.show} disabled={!attribution.allowed} onChange={event => attribution.onChange(event.target.checked)} /> <span>Show “Generated with Sliply” on documents{!attribution.allowed && <> — removing it is a Pro feature (<Link to="/plans">see plans</Link>)</>}</span></label>}</div></section>
}
