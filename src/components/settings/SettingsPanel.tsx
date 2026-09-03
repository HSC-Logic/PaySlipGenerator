import { Save, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppSettings, CurrencyCode } from '../../types'
import { currencies } from '../../utils/currency'

export function SettingsPanel({ settings, onSave }: { settings: AppSettings; onSave: (settings: AppSettings) => void }) {
  const [draft, setDraft] = useState(settings)
  useEffect(() => setDraft(settings), [settings])
  return <details className="settings-panel"><summary><Settings /> Settings</summary><div className="settings-fields"><label><span>Default currency</span><select value={draft.defaultCurrency} onChange={event => setDraft({ ...draft, defaultCurrency: event.target.value as CurrencyCode })}>{Object.entries(currencies).map(([code, currency]) => <option value={code} key={code}>{code} — {currency.symbol}</option>)}</select></label><label><span>Reference prefix</span><input value={draft.referencePrefix} maxLength={12} onChange={event => setDraft({ ...draft, referencePrefix: event.target.value })} aria-describedby="reference-prefix-hint" /><small id="reference-prefix-hint">Letters, numbers and single hyphens. Used for future references only.</small></label><button type="button" className="button secondary" onClick={() => onSave(draft)}><Save /> Save settings</button></div></details>
}
