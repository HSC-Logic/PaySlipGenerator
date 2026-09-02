// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentSlip } from '../types'
import { generatePdf, printPdf } from './pdf'

const slip: PaymentSlip = {
  company: { name: 'Example Company', address: 'Colombo', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#123456' },
  recipient: { name: 'Test Recipient', identification: '', role: '', address: '', email: '', telephone: '' },
  payment: { date: '2026-09-02', reference: 'PS-2026-0001', title: 'Services', method: 'Cash', bankName: '', transactionReference: '', notes: '', adjustment: 0, currency: 'LKR', sealText: '', paperSize: 'a4', orientation: 'landscape' },
  items: [{ id: '1', description: 'Service', quantity: 1, rate: 100 }],
  adjustments: [],
}

const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL

describe('PDF output actions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:payment-slip') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreate })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevoke })
    document.body.replaceChildren()
  })

  it('downloads the shared PDF blob and revokes its object URL', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    generatePdf(slip)
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    vi.advanceTimersByTime(1_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:payment-slip')
  })

  it('prints the shared PDF in a temporary iframe and cleans up after printing', async () => {
    const pending = printPdf(slip)
    const frame = document.querySelector('iframe') as HTMLIFrameElement
    expect(frame).not.toBeNull()
    expect(frame.src).toContain('blob:payment-slip')
    const printableWindow = frame.contentWindow as Window
    const focus = vi.spyOn(printableWindow, 'focus').mockImplementation(() => undefined)
    const print = vi.spyOn(printableWindow, 'print').mockImplementation(() => undefined)
    frame.dispatchEvent(new Event('load'))
    await pending
    expect(focus).toHaveBeenCalledOnce()
    expect(print).toHaveBeenCalledOnce()
    printableWindow.dispatchEvent(new Event('afterprint'))
    vi.advanceTimersByTime(500)
    expect(document.querySelector('iframe')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:payment-slip')
  })
})
