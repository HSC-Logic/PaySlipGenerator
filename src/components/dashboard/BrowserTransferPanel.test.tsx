// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBasicSlip } from '../../test/fixtures/paymentSlips'
import type { ImportRequest, ImportResponse } from '../../features/migration/browserImport'
import { saveHistory, saveRecipients } from '../../utils/storage'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1')
let auth = { user: { id: 'sub-1', email: 'a@b.c' } as { id: string; email: string } | null, plan: 'pro', lapsed: false, cloudAccess: true }
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => auth }))
vi.mock('../../services/cognito/auth', () => ({ getAccessContext: async () => ({ token: 't', pro: true, lapsed: false }) }))
const { BrowserTransferPanel } = await import('./BrowserTransferPanel')
const { ApiError } = await import('../../services/api/client')

afterEach(() => { cleanup(); vi.unstubAllGlobals(); auth = { user: { id: 'sub-1', email: 'a@b.c' }, plan: 'pro', lapsed: false, cloudAccess: true } })
const memory = () => { const values = new Map<string, string>(); return { get length() { return values.size }, clear: () => values.clear(), getItem: (k: string) => values.get(k) ?? null, key: (i: number) => [...values.keys()][i] ?? null, removeItem: (k: string) => { values.delete(k) }, setItem: (k: string, v: string) => { values.set(k, v) } } as Storage }
const seeded = (records = 2) => {
  const s = memory()
  saveHistory(s, Array.from({ length: records }, (_, i) => { const slip = createBasicSlip(); slip.payment.reference = `PS-2026-000${i + 1}`; return { id: `id-${i}`, createdAt: 1, updatedAt: 1, slip } }))
  saveRecipients(s, [{ id: 'r1', name: 'Nimal', role: 'Tutor', address: '', email: '', telephone: '' }])
  return s
}
const created = (body: ImportRequest): ImportResponse => ({ formatVersion: 1, items: [...(body.recipients ?? []).map(x => ({ kind: 'recipient' as const, sourceId: String(x.sourceId), outcome: 'created' as const })), ...(body.records ?? []).map(x => ({ kind: 'record' as const, sourceId: String(x.sourceId), outcome: 'created' as const }))] })

describe('BrowserTransferPanel', () => {
  it('renders nothing for an account without cloud access', async () => {
    auth = { ...auth, cloudAccess: false, plan: 'free' }
    const { container } = render(<BrowserTransferPanel storage={seeded()} />)
    await new Promise(resolve => setTimeout(resolve, 20)); expect(container.innerHTML).toBe('')
  })

  it('offers the transfer with counts and an editable computer name, and moves nothing until confirmed', async () => {
    const post = vi.fn(async (b: ImportRequest) => created(b))
    render(<BrowserTransferPanel storage={seeded()} post={post} />)
    expect(await screen.findByText(/1 recipient, 2 documents found on this computer/)).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Computer name'), { target: { value: 'Home PC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move to my cloud' }))
    expect(await screen.findByText('Transfer finished')).toBeTruthy()
    expect(post.mock.calls[0][0].device.label).toBe('Home PC')
  })

  it('shows the summary with needs-review items and invalid items with reasons', async () => {
    const post = vi.fn(async (): Promise<ImportResponse> => ({
      formatVersion: 1,
      items: [{ kind: 'record', sourceId: 'id-0', outcome: 'created', referenceConflict: true, totalsDiffer: true }, { kind: 'record', sourceId: 'id-1', outcome: 'invalid', reason: 'The document is not valid.', errors: { 'slip.items[0].quantity': ['Quantity must be positive.'] } }, { kind: 'recipient', sourceId: 'r1', outcome: 'matched' }],
      summary: { referenceConflicts: [{ reference: 'PS-2026-0001', count: 2 }], totalsDifferences: [{ kind: 'record', sourceId: 'id-0', reference: 'PS-2026-0001', stored: { finalTotal: 2999.5 }, recalculated: { finalTotal: 3000 } }], merged: [{ kind: 'recipient', name: 'Nimal', targetId: 't', targetName: 'Nimal Perera' }] },
    }))
    render(<BrowserTransferPanel storage={seeded()} post={post} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Move to my cloud' }))
    expect(await screen.findByText('Needs review')).toBeTruthy()
    expect(screen.getByText(/2 documents share/)).toBeTruthy()
    expect(screen.getByText(/stored a total of 2,999.50; Slipy recalculated 3,000.00/)).toBeTruthy()
    expect(screen.getByText(/linked to your existing recipient "Nimal Perera"/)).toBeTruthy()
    expect(screen.getByText(/Item 1 quantity: Quantity must be positive\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: "Remove this computer's copy" })).toBeTruthy()
  })

  it('stops on a failed batch, offers retry, and only then allows removing the copy', async () => {
    const s = seeded(); let calls = 0
    const post = vi.fn(async (b: ImportRequest) => { if (calls++ === 0) throw new ApiError('Server error', 500, 'unknown'); return created(b) })
    const confirmMock = vi.fn(() => true); vi.stubGlobal('confirm', confirmMock)
    render(<BrowserTransferPanel storage={s} post={post} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Move to my cloud' }))
    expect(await screen.findByText('Transfer stopped')).toBeTruthy()
    expect(screen.queryByRole('button', { name: "Remove this computer's copy" })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Retry from batch 1/ }))
    expect(await screen.findByText('Transfer finished')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: "Remove this computer's copy" }))
    expect(confirmMock).toHaveBeenCalled()
    await waitFor(() => expect(s.getItem('payment-slip-history')).toBeNull())
    expect(s.getItem('slipy-cloud-import:sub-1')).toBeTruthy()
  })

  it('does not remove the copy when the confirmation is declined', async () => {
    const s = seeded(); vi.stubGlobal('confirm', () => false)
    render(<BrowserTransferPanel storage={s} post={async b => created(b)} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Move to my cloud' }))
    fireEvent.click(await screen.findByRole('button', { name: "Remove this computer's copy" }))
    expect(s.getItem('payment-slip-history')).not.toBeNull()
  })

  it('warns before offering a transfer when the data already went to another account', async () => {
    const s = seeded(); s.setItem('slipy-cloud-import:other', JSON.stringify({ version: 1, at: 1, deviceId: 'd', items: {} }))
    render(<BrowserTransferPanel storage={s} post={async b => created(b)} />)
    expect(await screen.findByText(/already moved to a different Slipy account/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Move to my cloud' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'This is my data, continue' }))
    expect(screen.getByRole('button', { name: 'Move to my cloud' })).toBeTruthy()
  })

  it('shows the new-items banner on later sign-ins and hides when nothing is new', async () => {
    const s = seeded(1)
    const first = render(<BrowserTransferPanel storage={s} post={async b => created(b)} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Move to my cloud' })); await screen.findByText('Transfer finished'); first.unmount()
    const quiet = render(<BrowserTransferPanel storage={s} />)
    await new Promise(resolve => setTimeout(resolve, 30)); expect(quiet.container.innerHTML).toBe(''); quiet.unmount()
    saveHistory(s, [{ id: 'new-1', createdAt: 2, updatedAt: 2, slip: createBasicSlip() }, { id: 'pro-1', createdAt: 2, updatedAt: 2, slip: createBasicSlip(), savedUnderPlan: 'pro' }, ...JSON.parse(s.getItem('payment-slip-history')!).data])
    render(<BrowserTransferPanel storage={s} />)
    expect(await screen.findByText('This computer has 1 new item not in your cloud')).toBeTruthy()
  })
})
