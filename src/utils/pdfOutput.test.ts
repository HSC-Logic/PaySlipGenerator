// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { generatePdf, printPdf } from './pdf'

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

  it('downloads the shared PDF blob and revokes its object URL', async () => {
    const slip = createBasicSlip()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const pending = generatePdf(slip)
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(3000)
    expect(click).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(100)
    await pending
    expect(document.querySelector('a[download]')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:payment-slip')
  })

  it('prints the shared PDF in a temporary iframe and cleans up after printing', async () => {
    const slip = createBasicSlip(); slip.payment.orientation = 'landscape'
    const pending = printPdf(slip)
    const frame = document.querySelector('iframe') as HTMLIFrameElement
    expect(frame).not.toBeNull()
    expect(frame.src).toContain('blob:payment-slip')
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(3000)
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
