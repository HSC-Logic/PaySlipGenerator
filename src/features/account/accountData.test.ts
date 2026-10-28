import { afterEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1')
let access = { token: 'tok', pro: true, lapsed: false }
vi.mock('../../services/cognito/auth', () => ({ getAccessContext: async () => access }))
const { downloadAccountExport, deleteSlipyData, supportMailto } = await import('./accountData')
const { ApiError } = await import('../../services/api/client')

afterEach(() => { vi.unstubAllGlobals(); access = { token: 'tok', pro: true, lapsed: false } })
const urlOf = (mock: ReturnType<typeof vi.fn>, call = 0) => (mock.mock.calls[call] as unknown as [string, RequestInit])

describe('account data', () => {
  it('saves the export under the server file name', async () => {
    const fetchMock = vi.fn(async () => new Response('{"format":"slipy-export"}', { headers: { 'Content-Disposition': 'attachment; filename="slipy-export-20261026.json"' } }))
    vi.stubGlobal('fetch', fetchMock)
    const save = vi.fn()
    await expect(downloadAccountExport(save)).resolves.toBe('slipy-export-20261026.json')
    expect(urlOf(fetchMock)[0]).toBe('https://api.test/api/v1/account/export')
    expect(save.mock.calls[0][1]).toBe('slipy-export-20261026.json')
  })
  it('allows a lapsed token for the export and falls back to a dated name', async () => {
    access = { token: 'tok', pro: false, lapsed: true }
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'Content-Disposition': 'attachment; filename="../../evil"' } })))
    await expect(downloadAccountExport(vi.fn(), new Date('2026-10-26T10:00:00Z'))).resolves.toBe('slipy-export-20261026.json')
  })
  it('reports an archived export (410) without saving', async () => {
    access = { token: 'tok', pro: false, lapsed: true }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'https://slipy.hsclogic.link/problems/data-archived' }), { status: 410 })))
    const save = vi.fn()
    const error = await downloadAccountExport(save).catch(reason => reason)
    expect(error).toBeInstanceOf(ApiError); expect(error).toMatchObject({ status: 410, kind: 'data-archived' }); expect(save).not.toHaveBeenCalled()
  })
  it('never calls the API for delete without slipy-pro', async () => {
    access = { token: 'tok', pro: false, lapsed: true }
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await expect(deleteSlipyData()).rejects.toMatchObject({ kind: 'pro-required' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('deletes with DELETE /account for Pro', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetchMock)
    await deleteSlipyData()
    expect(urlOf(fetchMock)).toEqual(['https://api.test/api/v1/account', expect.objectContaining({ method: 'DELETE' })])
  })
  it('builds a support mail with the user id', () => { const link = supportMailto('delete-data', 'abc-123'); expect(link.startsWith('mailto:info@hsclogic.com?')).toBe(true); expect(decodeURIComponent(link)).toContain('Slipy user ID: abc-123') })
})
