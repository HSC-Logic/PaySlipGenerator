import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBasicSlip } from '../../test/fixtures/paymentSlips'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1')
vi.mock('../cognito/auth', () => ({ getAccessContext: async () => ({ token: 't', pro: true, lapsed: false }) }))
const { ApiCompanyRepository, ApiPaymentRepository, ApiRecipientRepository, paymentQuery } = await import('./apiRepository')

afterEach(() => vi.unstubAllGlobals())
const calls = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls as unknown as [string, RequestInit][]
const stub = (...responses: Response[]) => { const mock = vi.fn(async () => responses.shift() ?? Response.json({})); vi.stubGlobal('fetch', mock); return mock }

describe('payment list query', () => {
  it('sends only the filters that are set, with the keyset cursor and a page limit', () => {
    const params = new URLSearchParams(paymentQuery({ query: 'abc', status: '', companyId: 'c1', sort: 'oldest', dateFrom: '2026-01-01' }, 'cur'))
    expect(Object.fromEntries(params)).toEqual({ query: 'abc', companyId: 'c1', sort: 'oldest', dateFrom: '2026-01-01', cursor: 'cur', limit: '100' })
  })
})

describe('ApiPaymentRepository', () => {
  it('returns a page with the next cursor', async () => {
    const mock = stub(Response.json({ items: [{ id: 'p1', companyId: 'c1', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z', version: 1, slip: createBasicSlip() }], nextCursor: 'next' }))
    const page = await new ApiPaymentRepository().listPage({ sort: 'newest' }, 'prev')
    expect(page.nextCursor).toBe('next'); expect(page.items[0].id).toBe('p1')
    expect(calls(mock)[0][0]).toBe('https://api.test/api/v1/payment-slips?sort=newest&cursor=prev&limit=100')
  })
  it('replaces with PUT and the loaded version, and surfaces 409 as a conflict', async () => {
    const mock = stub(new Response('{}', { status: 409 }))
    await expect(new ApiPaymentRepository().update('p1', createBasicSlip(), 'c1', undefined, 5)).rejects.toMatchObject({ status: 409, kind: 'conflict' })
    const [url, init] = calls(mock)[0]
    expect(url).toBe('https://api.test/api/v1/payment-slips/p1'); expect(init.method).toBe('PUT'); expect(JSON.parse(String(init.body))).toMatchObject({ companyId: 'c1', version: 5 })
  })
  it('reserves the next reference with POST /companies/{id}/references', async () => {
    const mock = stub(Response.json({ reference: 'PS-2026-0042' }))
    await expect(new ApiPaymentRepository().nextReference('c 1')).resolves.toBe('PS-2026-0042')
    expect(calls(mock)[0][0]).toBe('https://api.test/api/v1/companies/c%201/references'); expect(calls(mock)[0][1].method).toBe('POST')
  })
  it('treats 404 on get as missing', async () => { stub(new Response('{}', { status: 404 })); await expect(new ApiPaymentRepository().get('x')).resolves.toBeNull() })
})

describe('company and recipient repositories', () => {
  it('creates with POST when new and updates with PUT when the row has a version', async () => {
    const mock = stub(Response.json({ id: 'n1', name: 'A', address: 'B', version: 1 }), Response.json({ id: 'n1', name: 'A2', address: 'B', version: 2 }))
    const repo = new ApiCompanyRepository()
    const base = { id: 'tmp', name: 'A', address: 'B', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#000000', referencePrefix: 'PS', defaultCurrency: 'LKR' as const, defaultPaperSize: 'a4' as const, defaultOrientation: 'portrait' as const, showSliplyBranding: true, isDefault: false, archivedAt: null }
    const created = await repo.save(base)
    const updated = await repo.save({ ...created, name: 'A2' })
    expect(calls(mock).map(([url, init]) => `${init.method} ${url}`)).toEqual(['POST https://api.test/api/v1/companies', 'PUT https://api.test/api/v1/companies/n1'])
    expect(JSON.parse(String(calls(mock)[1][1].body))).toMatchObject({ name: 'A2', version: 1 }); expect(updated.version).toBe(2)
  })
  it('lists recipients from a plain array and archives with DELETE', async () => {
    const mock = stub(Response.json([{ id: 'r1', name: 'Sam', version: 1 }]), new Response(null, { status: 204 }))
    const repo = new ApiRecipientRepository()
    expect((await repo.list())[0]).toMatchObject({ id: 'r1', name: 'Sam', identification: '' })
    await repo.archive('r1'); expect(calls(mock)[1][1].method).toBe('DELETE')
  })
})
