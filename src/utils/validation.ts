import type { Errors, PaymentSlip, WorkflowStep } from '../types'
import { finalTotal } from './currency'
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const validateSlip = (slip: PaymentSlip): Errors => {
  const e: Errors = {}
  if (!slip.company.name.trim()) e['company.name'] = 'Company name is required.'
  if (!slip.company.address.trim()) e['company.address'] = 'Company address is required.'
  if (!/^#[0-9a-f]{6}$/i.test(slip.company.themeColor)) e['company.themeColor'] = 'Enter a valid six-digit hex color.'
  if (slip.company.email && !email.test(slip.company.email)) e['company.email'] = 'Enter a valid email address.'
  if (!slip.recipient.name.trim()) e['recipient.name'] = 'Recipient name is required.'
  if (!slip.recipient.role.trim()) e['recipient.role'] = 'Role or designation is required.'
  if (slip.recipient.email && !email.test(slip.recipient.email)) e['recipient.email'] = 'Enter a valid email address.'
  if (!slip.payment.date || Number.isNaN(Date.parse(slip.payment.date))) e['payment.date'] = 'A valid payment date is required.'
  if (!slip.payment.reference.trim()) e['payment.reference'] = 'Payment reference is required.'
  if (!slip.payment.title.trim()) e['payment.title'] = 'Payment purpose is required.'
  if (slip.payment.status === 'paid' && slip.payment.paidDate && Number.isNaN(Date.parse(slip.payment.paidDate))) e['payment.paidDate'] = 'Enter a valid paid date or leave it empty.'
  slip.items.forEach((item, i) => {
    if (!item.description.trim()) e[`items.${i}.description`] = 'Description is required.'
    if (item.quantity === '' || !Number.isFinite(Number(item.quantity)) || !(Number(item.quantity) > 0)) e[`items.${i}.quantity`] = 'Enter a quantity greater than zero.'
    if (item.rate === '' || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0) e[`items.${i}.rate`] = 'Enter a valid rate of zero or more.'
  })
  if (!slip.items.length) e.items = 'Add at least one payment item.'
  slip.adjustments.forEach((entry, i) => {
    if (!entry.label.trim()) e[`adjustments.${i}.label`] = 'Enter a label.'
    if (entry.value === '' || !Number.isFinite(Number(entry.value)) || Number(entry.value) < 0) e[`adjustments.${i}.value`] = 'Enter a valid value of zero or more.'
    if (entry.mode === 'percentage' && Number(entry.value) > 100 && entry.kind === 'discount') e[`adjustments.${i}.value`] = 'Discount cannot exceed 100%.'
  })
  if (slip.payment.adjustment !== '' && !Number.isFinite(Number(slip.payment.adjustment))) e.adjustment = 'Enter a valid adjustment amount.'
  else if (finalTotal(slip.items, slip.payment.adjustment, slip.adjustments) < 0) e.adjustment = 'Reduce the deduction so the final total is not negative.'
  return e
}

export const errorsForStep = (errors: Errors, step: WorkflowStep): Errors => {
  if (step === 'review') return errors
  const prefix = step === 'company' ? 'company.' : step === 'recipient' ? 'recipient.' : ''
  return Object.fromEntries(Object.entries(errors).filter(([key]) => step === 'payment' ? !key.startsWith('company.') && !key.startsWith('recipient.') : key.startsWith(prefix)))
}
