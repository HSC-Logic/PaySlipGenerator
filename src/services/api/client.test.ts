import { afterEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1/')
let access = { token: 'token-123', pro: true, lapsed: false }
vi.mock('../cognito/auth', () => ({ getAccessContext: async () => access }))

const { apiFetch, ApiError, onProRequired } = await import('./client')

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
})
