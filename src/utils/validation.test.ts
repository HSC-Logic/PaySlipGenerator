import { describe, expect, it } from 'vitest'
import type { PaymentSlip } from '../types'
import { errorsForStep, validateSlip } from './validation'

const validSlip = (): PaymentSlip => ({
  company: { name: 'Example Company', address: 'Colombo', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#0b1f3a' },
  recipient: { name: 'Example Recipient', identification: '', role: 'Consultant', address: '', email: '', telephone: '' },
  payment: { date: '2026-08-31', reference: 'PAY-001', title: 'Services', method: 'Cash', status: 'draft', paidDate: '', paidReference: '', bankName: '', transactionReference: '', notes: '', adjustment: '', currency: 'LKR', sealText: '', paperSize: 'a4', orientation: 'portrait' },
  items: [{ id: '1', description: 'Consulting', quantity: 1, rate: 0 }],
  adjustments: [],
})

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

  it('accepts empty optional fields', () => {
    expect(validateSlip(validSlip())).toEqual({})
  })

  it('keeps paid metadata optional and ignores it for non-paid statuses', () => {
    const slip = validSlip()
    slip.payment.status = 'paid'
    expect(validateSlip(slip)).toEqual({})
    slip.payment.paidDate = 'not-a-date'
    expect(validateSlip(slip)['payment.paidDate']).toBe('Enter a valid paid date or leave it empty.')
    slip.payment.status = 'pending'
    expect(validateSlip(slip)['payment.paidDate']).toBeUndefined()
  })

  it('rejects malformed and out-of-range numeric values', () => {
    const slip = validSlip()
    slip.items[0].quantity = Number.NaN
    slip.items[0].rate = Number.NaN
    slip.payment.adjustment = Number.NaN
    slip.adjustments = [{ id: 'a', label: 'Discount', kind: 'discount', mode: 'percentage', value: Number.NaN }]
    const result = validateSlip(slip)
    expect(result['items.0.quantity']).toBe('Enter a quantity greater than zero.')
    expect(result['items.0.rate']).toBe('Enter a valid rate of zero or more.')
    expect(result.adjustment).toBe('Enter a valid adjustment amount.')
    expect(result['adjustments.0.value']).toBe('Enter a valid value of zero or more.')
  })

  it('rejects negative and empty line-item input while allowing a zero rate', () => {
    const slip = validSlip()
    slip.items = [
      { id: 'empty', description: '', quantity: '', rate: '' },
      { id: 'negative', description: 'Invalid values', quantity: -1, rate: -0.01 },
      { id: 'zero', description: 'Free item', quantity: 1, rate: 0 },
    ]
    const result = validateSlip(slip)
    expect(result['items.0.description']).toBe('Description is required.')
    expect(result['items.0.quantity']).toBe('Enter a quantity greater than zero.')
    expect(result['items.0.rate']).toBe('Enter a valid rate of zero or more.')
    expect(result['items.1.quantity']).toBe('Enter a quantity greater than zero.')
    expect(result['items.1.rate']).toBe('Enter a valid rate of zero or more.')
    expect(result['items.2.rate']).toBeUndefined()
  })

  it('rejects malformed optional email values only when provided', () => {
    const slip = validSlip()
    slip.company.email = 'not-an-email'
    slip.recipient.email = 'also-invalid'
    const result = validateSlip(slip)
    expect(result['company.email']).toBe('Enter a valid email address.')
    expect(result['recipient.email']).toBe('Enter a valid email address.')
  })
})
