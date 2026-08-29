import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

type Props = { label: string; error?: string; hint?: string; children?: ReactNode }
export const Field = ({ label, error, hint, children }: Props) => <label className={`field ${error ? 'has-error' : ''}`}>
  <span>{label}</span>{children}{error && <small className="error" role="alert">{error}</small>}{!error && hint && <small>{hint}</small>}
</label>
export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />
export const TextArea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...props} />
