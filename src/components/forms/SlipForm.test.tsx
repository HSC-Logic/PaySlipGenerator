// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBasicSlip } from '../../test/fixtures/paymentSlips'
import type { PaymentSlip } from '../../types'
import { SlipForm } from './SlipForm'

const handlers = { onReference: vi.fn(), onSaveCompany: vi.fn(), onClearCompany: vi.fn(), onSelectRecipient: vi.fn(), onSaveRecipient: vi.fn(), onDeleteRecipient: vi.fn(), onLogoError: vi.fn(), onSubmit: vi.fn() }

afterEach(cleanup)

function Harness({ initial, step = 'payment' }: { initial: PaymentSlip; step?: 'company' | 'recipient' | 'payment' }) {
  const [slip, setSlip] = useState(initial)
  const [quick, setQuick] = useState(true)
  return <><button onClick={() => setQuick(value => !value)}>Switch mode</button><SlipForm slip={slip} errors={{}} step={step} quickMode={quick} hasCompanyProfile={Boolean(initial.company.name)} savedRecipients={[]} selectedRecipientId="" onChange={setSlip} {...handlers} /></>
}

describe('Quick Slip interaction mode', () => {
  it('shows actual required payment fields and progressively discloses optional sections', () => {
    render(<Harness initial={createBasicSlip()} />)
    for (const label of ['Payment date', 'Payment reference', 'Payment title / purpose', 'Currency', 'Description', 'Qty', 'Rate']) expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeTruthy()
    const disclosures = document.querySelectorAll('details.quick-advanced')
    expect(disclosures.length).toBeGreaterThan(1)
    expect([...disclosures].every(details => !(details as HTMLDetailsElement).open)).toBe(true)
  })

  it('uses populated company state and preserves advanced values across mode changes', () => {
    const slip = createBasicSlip()
    slip.payment.notes = 'Keep this advanced note'
    const { getAllByLabelText, getByLabelText, getByRole, rerender } = render(<Harness initial={slip} step="company" />)
    expect(getByLabelText(/^Company name/)).toHaveProperty('value', 'Example Company')
    rerender(<Harness initial={slip} />)
    expect(getAllByLabelText('Notes').some(field => (field as HTMLTextAreaElement).value === 'Keep this advanced note')).toBe(true)
    fireEvent.click(getByRole('button', { name: 'Switch mode' }))
    fireEvent.click(getByRole('button', { name: 'Switch mode' }))
    expect(getAllByLabelText('Notes').some(field => (field as HTMLTextAreaElement).value === 'Keep this advanced note')).toBe(true)
  })
})
