import { useEffect, useRef, type ReactNode } from 'react'

/** A native modal dialog: focus is trapped, Escape and a click on the backdrop close it. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current; if (!element) return
    element.showModal()
    // On touch screens, focusing a field would raise the keyboard over the form; keep focus on the sheet instead.
    if (matchMedia('(pointer: coarse)').matches) element.focus()
    else element.querySelector<HTMLElement>('input:not([type=checkbox]), textarea, select')?.focus()
  }, [])
  return <dialog ref={dialog} className="app-modal" tabIndex={-1} aria-labelledby="app-modal-title" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current?.close() }}>
    <div className="app-modal-head"><h2 id="app-modal-title">{title}</h2><button type="button" className="icon-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button></div>
    {children}
  </dialog>
}
