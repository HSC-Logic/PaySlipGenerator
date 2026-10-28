import { afterEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1')
vi.mock('./cognito/auth', () => ({ getAccessContext: async () => ({ token: 't', pro: true, lapsed: false }) }))
const { loadDashboardSummary, normalizeSummary } = await import('./dashboard')
afterEach(() => vi.unstubAllGlobals())

describe('dashboard summary', () => {
  it('asks the API for the month in the caller time zone', async () => {
    const fetchMock = vi.fn(async () => Response.json({ currentMonth: 3, draft: '1', pending: 2, paid: null })); vi.stubGlobal('fetch', fetchMock)
    await expect(loadDashboardSummary()).resolves.toEqual({ currentMonth: 3, draft: 1, pending: 2, paid: 0 })
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0])
    expect(url.pathname).toBe('/api/v1/dashboard/summary'); expect(url.searchParams.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })
  it('falls back to zeros for a malformed payload', () => { expect(normalizeSummary(null)).toEqual({ currentMonth: 0, draft: 0, pending: 0, paid: 0 }) })
})
