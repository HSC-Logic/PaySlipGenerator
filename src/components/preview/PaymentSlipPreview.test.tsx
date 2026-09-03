// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../../test/fixtures/paymentSlips'
import { PaymentSlipPreview } from './PaymentSlipPreview'

describe('PaymentSlipPreview footer', () => {
  it('shows Sliply attribution alongside the existing footer content', () => {
    render(<PaymentSlipPreview slip={createBasicSlip()} />)
    expect(screen.getByText('Generated with Sliply').classList.contains('sliply-attribution')).toBe(true)
    expect(screen.queryByText('Generated locally in your browser')).toBeNull()
    expect(screen.getAllByText('PAY/001')).toHaveLength(2)
  })
})
