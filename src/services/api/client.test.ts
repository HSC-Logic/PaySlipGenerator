import { afterEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1/')
let access = { token: 'token-123', pro: true, lapsed: false }
vi.mock('../cognito/auth', () => ({ getAccessContext: async () => access }))

const { apiFetch, ApiError, describeField, onProRequired } = await import('./client')

afterEach(() => { vi.unstubAllGlobals(); access = { token: 'token-123', pro: true, lapsed: false } })

describe('apiFetch', () => {
  it('sends the bearer token and parses JSON', async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 'u1', plan: 'pro' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiFetch('/me')).resolves.toEqual({ id: 'u1', plan: 'pro' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/api/v1/me')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-123')
  })

  it('skips the token for unauthenticated calls', async () => {
    const fetchMock = vi.fn(async () => Response.json({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/health', { authenticated: false })
    expect(new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).has('Authorization')).toBe(false)
  })

  it('maps pro-required problem details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'https://slipy.hsclogic.link/problems/pro-required', title: 'Forbidden', detail: 'Slipy Pro is required.' }), { status: 403, headers: { 'Content-Type': 'application/problem+json' } })))
    const error = await apiFetch('/me').catch(reason => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, kind: 'pro-required', message: 'Slipy Pro is required.' })
  })

  it('exposes Retry-After and tolerates non-JSON error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503, headers: { 'Retry-After': '7' } })))
    const error = await apiFetch('/me').catch(reason => reason)
    expect(error).toMatchObject({ status: 503, kind: 'unknown', retryAfterSeconds: 7 })
  })

  it('refuses to call the API when the token lacks slipy-pro, and tells listeners', async () => {
    access = { token: 'token-123', pro: false, lapsed: false }
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    const listener = vi.fn(); const off = onProRequired(listener)
    await expect(apiFetch('/payment-slips')).rejects.toMatchObject({ status: 403, kind: 'pro-required' })
    off()
    expect(fetchMock).not.toHaveBeenCalled(); expect(listener).toHaveBeenCalledOnce()
  })

  it('lets a lapsed token through only when the call opts in', async () => {
    access = { token: 'token-123', pro: false, lapsed: true }
    const fetchMock = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', fetchMock)
    await expect(apiFetch('/me')).rejects.toMatchObject({ kind: 'pro-required' })
    await expect(apiFetch('/account/export', { allowLapsed: true })).resolves.toEqual({})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('notifies listeners when the server rejects a stale token and maps 409 and 410', async () => {
    const listener = vi.fn(); const off = onProRequired(listener)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'https://slipy.hsclogic.link/problems/pro-required' }), { status: 403 })))
    await expect(apiFetch('/companies')).rejects.toMatchObject({ kind: 'pro-required' })
    off(); expect(listener).toHaveBeenCalledOnce()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 409 })))
    await expect(apiFetch('/companies/1', { method: 'PUT', body: '{}' })).rejects.toMatchObject({ status: 409, kind: 'conflict' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'https://slipy.hsclogic.link/problems/reference-taken', detail: 'Reference used.' }), { status: 409 })))
    await expect(apiFetch('/payment-slips', { method: 'POST', body: '{}' })).rejects.toMatchObject({ kind: 'reference-taken', message: 'Reference used.' })
  })

  const problem = (slug: string, status: number, extra: Record<string, unknown> = {}) => new Response(JSON.stringify({ type: `https://slipy.hsclogic.link/problems/${slug}`, ...extra }), { status })
  it.each([
    ['name-taken', 409, 'A design with this name already exists. Choose a different name.'],
    ['not-found', 404, 'That item no longer exists, or it belongs to another account.'],
    ['drive-not-connected', 409, 'Google Drive is not connected. Connect it and try again.'],
    ['drive-reconnect-required', 409, 'Google Drive access expired or was revoked. Reconnect Google Drive to continue.'],
    ['drive-code-rejected', 400, 'Google did not accept the authorization. Start the connection again.'],
    ['drive-folder-not-found', 404, 'That Drive folder no longer exists or is not accessible. Choose another folder.'],
    ['drive-unavailable', 502, 'Google Drive is temporarily unavailable. Try again in a moment.'],
    ['drive-not-configured', 503, 'Google Drive is not available on this server yet. Try again later.'],
  ] as const)('maps %s to a clear message', async (slug, status, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => problem(slug, status, { detail: 'raw server text' })))
    await expect(apiFetch('/x')).rejects.toMatchObject({ kind: slug, status, message })
  })
  it('keeps the server detail for drive-invalid-request and maps a bare 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => problem('drive-invalid-request', 413, { detail: 'The PDF is larger than 10 MB.' })))
    await expect(apiFetch('/x')).rejects.toMatchObject({ kind: 'drive-invalid-request', message: 'The PDF is larger than 10 MB.' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    await expect(apiFetch('/x')).rejects.toMatchObject({ kind: 'not-found' })
  })
  it('turns validation errors into readable field messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => problem('validation', 400, { errors: { 'slip.items[0].quantity': ['must have at most 4 decimals'], referencePrefix: ['is invalid'] } })))
    const error = await apiFetch('/payment-slips', { method: 'POST', body: '{}' }).catch(reason => reason)
    expect(error).toMatchObject({ kind: 'validation', status: 400, fieldErrors: { 'slip.items[0].quantity': ['must have at most 4 decimals'] } })
    expect(error.message).toContain('Item 1 quantity: must have at most 4 decimals'); expect(error.message).toContain('Reference prefix: is invalid')
  })
  it('describes field paths in words', () => {
    expect(describeField('slip.adjustments[2].value')).toBe('Adjustment 3 value'); expect(describeField('slip.payment.paidDate')).toBe('Payment paid date'); expect(describeField('version')).toBe('Version')
  })
})
