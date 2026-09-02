import { describe, expect, it, vi } from 'vitest'
import type jsPDF from 'jspdf'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { copySlip } from './dirtyState'
import { runDocumentAction, type DocumentAction } from './documentActions'

describe.each(['download', 'print'] as const)('%s document action failure', action => {
  it('shows only an error, resets busy state, and preserves payment data', async () => {
    const slip = createBasicSlip()
    const before = copySlip(slip)
    const failure = new Error(`${action} renderer failed`)
    const build = vi.fn(() => { throw failure })
    const download = vi.fn(async () => undefined)
    const print = vi.fn(async () => undefined)
    const setBusy = vi.fn()
    const notify = vi.fn()
    const reportError = vi.fn()

    await runDocumentAction({ action: action as DocumentAction, slip, build, download, print, setBusy, notify, reportError })

    expect(build).toHaveBeenCalledWith(slip)
    expect(download).not.toHaveBeenCalled()
    expect(print).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('error', expect.stringContaining(action === 'download' ? 'could not be generated' : 'could not be prepared'))
    expect(setBusy.mock.calls).toEqual([[action], ['']])
    expect(reportError).toHaveBeenCalledWith(failure)
    expect(slip).toEqual(before)
  })
})

describe('successful document actions', () => {
  it.each(['download', 'print'] as const)('waits for %s completion before showing success', async action => {
    const document = {} as jsPDF
    let complete: (() => void) | undefined
    const operation = vi.fn(() => new Promise<void>(resolve => { complete = resolve }))
    const notify = vi.fn()
    const setBusy = vi.fn()
    const pending = runDocumentAction({ action, slip: createBasicSlip(), build: () => document, download: operation, print: operation, setBusy, notify })
    expect(notify).not.toHaveBeenCalled()
    expect(setBusy).toHaveBeenLastCalledWith(action)
    complete?.()
    await pending
    expect(notify).toHaveBeenCalledWith('success', expect.any(String))
    expect(setBusy).toHaveBeenLastCalledWith('')
  })
})
