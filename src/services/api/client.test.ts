import { afterEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1/')
const getAccessToken = vi.fn(async () => 'token-123')
vi.mock('../cognito/auth', () => ({ getAccessToken: () => getAccessToken() }))

const { apiFetch, ApiError } = await import('./client')

afterEach(() => vi.unstubAllGlobals())

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
})
