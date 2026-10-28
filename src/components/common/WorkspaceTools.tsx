import type { KeyboardEvent, ReactNode } from 'react'

export type WorkspaceToolId = 'history' | 'drive' | 'settings' | 'privacy'

export function WorkspaceTools({ active, onChange, panels }: { active: WorkspaceToolId; onChange: (id: WorkspaceToolId) => void; panels: Record<WorkspaceToolId, ReactNode> }) {
  const tabs: { id: WorkspaceToolId; label: string }[] = [
    { id: 'history', label: 'Payment history' },
    { id: 'drive', label: 'Google Drive' },
    { id: 'settings', label: 'Settings' },
    { id: 'privacy', label: 'Privacy & data' },
  ]
  const selectFromKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex(tab => tab.id === active)
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (nextIndex < 0) return
    event.preventDefault()
    const next = tabs[nextIndex].id
    onChange(next)
    requestAnimationFrame(() => document.getElementById(`tool-tab-${next}`)?.focus())
  }
  return <section className="workspace-tools" aria-label="Workspace tools">
    <div className="workspace-tool-tabs" role="tablist" aria-label="Workspace tools" onKeyDown={selectFromKeyboard}>
      {tabs.map(tab => <button key={tab.id} type="button" role="tab" id={`tool-tab-${tab.id}`} aria-selected={active === tab.id} aria-controls={`tool-panel-${tab.id}`} tabIndex={active === tab.id ? 0 : -1} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
    </div>
    {tabs.map(tab => <div key={tab.id} role="tabpanel" id={`tool-panel-${tab.id}`} aria-labelledby={`tool-tab-${tab.id}`} hidden={active !== tab.id} className="workspace-tool-panel">{panels[tab.id]}</div>)}
  </section>
}
