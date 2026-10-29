import { useEffect, useRef, type ReactNode } from 'react'

/** A native modal dialog: focus is trapped, Escape and a click on the backdrop close it. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="app-modal" aria-labelledby="app-modal-title" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current?.close() }}>
    <div className="app-modal-head"><h2 id="app-modal-title">{title}</h2><button type="button" className="icon-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button></div>
    {children}
  </dialog>
}
