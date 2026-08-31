import { createContext, useContext, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type FieldContextValue = { controlId: string; descriptionId?: string; errorKey?: string }
const FieldContext = createContext<FieldContextValue | null>(null)

type Props = { label: string; error?: string; errorKey?: string; hint?: string; children?: ReactNode; required?: boolean; controlId?: string }
export const Field = ({ label, error, errorKey, hint, children, required, controlId: suppliedId }: Props) => {
  const generatedId = useId()
  const controlId = suppliedId || `field-${generatedId.replace(/:/g, '')}`
  const descriptionId = error || hint ? `${controlId}-${error ? 'error' : 'hint'}` : undefined
  return <FieldContext.Provider value={{ controlId, descriptionId, errorKey }}><div className={`field ${error ? 'has-error' : ''}`}>
    <label htmlFor={controlId}>{label}{required && <span className="required-mark" aria-hidden="true"> *</span>}</label>
    {children}
    {error && <small id={descriptionId} className="error">{error}</small>}
    {!error && hint && <small id={descriptionId}>{hint}</small>}
  </div></FieldContext.Provider>
}

const describedBy = (own: string | undefined, field: string | undefined) => [own, field].filter(Boolean).join(' ') || undefined
export const Input = ({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }: InputHTMLAttributes<HTMLInputElement>) => { const field = useContext(FieldContext); return <input id={id || field?.controlId} aria-describedby={describedBy(ariaDescribedBy, field?.descriptionId)} aria-invalid={ariaInvalid ?? (field?.errorKey ? true : undefined)} data-error-key={field?.errorKey} {...props} /> }
export const TextArea = ({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => { const field = useContext(FieldContext); return <textarea id={id || field?.controlId} aria-describedby={describedBy(ariaDescribedBy, field?.descriptionId)} aria-invalid={ariaInvalid ?? (field?.errorKey ? true : undefined)} data-error-key={field?.errorKey} rows={3} {...props} /> }
export const Select = ({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => { const field = useContext(FieldContext); return <select id={id || field?.controlId} aria-describedby={describedBy(ariaDescribedBy, field?.descriptionId)} aria-invalid={ariaInvalid ?? (field?.errorKey ? true : undefined)} data-error-key={field?.errorKey} {...props} /> }
