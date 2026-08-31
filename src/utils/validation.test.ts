import { describe, expect, it } from 'vitest'
import { errorsForStep } from './validation'

describe('workflow validation', () => {
  const errors = {
    'company.name': 'Company name is required.',
    'recipient.name': 'Recipient name is required.',
    'payment.title': 'Payment purpose is required.',
    'items.0.description': 'Description is required.',
  }

  it('shows only errors relevant to the active entry step', () => {
    expect(Object.keys(errorsForStep(errors, 'company'))).toEqual(['company.name'])
    expect(Object.keys(errorsForStep(errors, 'recipient'))).toEqual(['recipient.name'])
    expect(Object.keys(errorsForStep(errors, 'payment'))).toEqual(['payment.title', 'items.0.description'])
  })

  it('shows all errors during review', () => {
    expect(errorsForStep(errors, 'review')).toEqual(errors)
  })
})
