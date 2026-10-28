import type { CloudCompany, CloudDesign, CustomDesign, CloudPaymentRecord, CloudRecipient, PaymentSlip, PaymentSlipFilters } from '../../types'
import { apiFetch } from '../api/client'
import type { CompanyRepository, DesignRepository, PaymentPage, PaymentSlipRepository, RecipientRepository } from './contracts'
import { companyFromDto, designFromDto, designToDto, companyToDto, recipientFromDto, recipientToDto, recordFromDto, slipToDto } from './mappers'

const PAGE_SIZE = 100
const json = (body: unknown) => JSON.stringify(body)
const itemsOf = (payload: unknown): Record<string, any>[] => Array.isArray(payload) ? payload : Array.isArray((payload as { items?: unknown } | null)?.items) ? (payload as { items: Record<string, any>[] }).items : []
const browserTimeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined } catch { return undefined } }
const encode = (id: string) => encodeURIComponent(id)

/** Rows the server has not stored yet carry no `version`; those are created with POST, the rest replaced with PUT. */
export class ApiCompanyRepository implements CompanyRepository {
  async list() { return itemsOf(await apiFetch('/companies')).map(companyFromDto) }
  async save(company: CloudCompany) {
    const body = json(companyToDto(company))
    return companyFromDto(company.version === undefined ? await apiFetch('/companies', { method: 'POST', body }) : await apiFetch(`/companies/${encode(company.id)}`, { method: 'PUT', body }))
  }
  async archive(id: string) { await apiFetch(`/companies/${encode(id)}`, { method: 'DELETE' }) }
}
export class ApiRecipientRepository implements RecipientRepository {
  async list() { return itemsOf(await apiFetch('/recipients')).map(recipientFromDto) }
  async save(recipient: CloudRecipient) {
    const body = json(recipientToDto(recipient))
    return recipientFromDto(recipient.version === undefined ? await apiFetch('/recipients', { method: 'POST', body }) : await apiFetch(`/recipients/${encode(recipient.id)}`, { method: 'PUT', body }))
  }
  async archive(id: string) { await apiFetch(`/recipients/${encode(id)}`, { method: 'DELETE' }) }
}

export class ApiDesignRepository implements DesignRepository {
  async list(): Promise<CloudDesign[]> { return itemsOf(await apiFetch('/designs')).flatMap(row => { const design = designFromDto(row); return design ? [design] : [] }) }
  private read(row: Record<string, any>): CloudDesign { const design = designFromDto(row); if (!design) throw new Error('The server returned a design that could not be read.'); return design }
  async create(design: CustomDesign) { return this.read(await apiFetch('/designs', { method: 'POST', body: json(designToDto(design)) })) }
  async update(id: string, design: CustomDesign, version: number) { return this.read(await apiFetch(`/designs/${encode(id)}`, { method: 'PUT', body: json(designToDto({ ...design, version })) })) }
  async remove(id: string) { await apiFetch(`/designs/${encode(id)}`, { method: 'DELETE' }) }
}

export const paymentQuery = (filters: PaymentSlipFilters = {}, cursor?: string | null, limit = PAGE_SIZE) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filters, cursor, limit })) if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  return params.toString()
}

export class ApiPaymentRepository implements PaymentSlipRepository {
  async listPage(filters: PaymentSlipFilters = {}, cursor?: string | null): Promise<PaymentPage> {
    const payload = await apiFetch<unknown>(`/payment-slips?${paymentQuery(filters, cursor)}`)
    const next = (payload as { nextCursor?: unknown } | null)?.nextCursor
    return { items: itemsOf(payload).map(recordFromDto), nextCursor: typeof next === 'string' && next ? next : null }
  }
  async list(filters: PaymentSlipFilters = {}) { return (await this.listPage(filters)).items }
  async get(id: string): Promise<CloudPaymentRecord | null> {
    try { return recordFromDto(await apiFetch(`/payment-slips/${encode(id)}`)) } catch (error) { if ((error as { status?: number }).status === 404) return null; throw error }
  }
  async create(slip: PaymentSlip, companyId: string, recipientId?: string) { return recordFromDto(await apiFetch('/payment-slips', { method: 'POST', body: json(slipToDto(slip, companyId, recipientId)) })) }
  async update(id: string, slip: PaymentSlip, companyId: string, recipientId?: string, version?: number) {
    const expected = version ?? (await this.get(id))?.version
    return recordFromDto(await apiFetch(`/payment-slips/${encode(id)}`, { method: 'PUT', body: json(slipToDto(slip, companyId, recipientId, expected)) }))
  }
  async remove(id: string) { await apiFetch(`/payment-slips/${encode(id)}`, { method: 'DELETE' }) }
  /** `timeZone` (IANA) decides which year the reference carries; it defaults to this browser's zone, the server's default is UTC. */
  async nextReference(companyId: string, timeZone: string | undefined = browserTimeZone()) {
    const query = timeZone ? `?tz=${encodeURIComponent(timeZone)}` : ''
    const result = await apiFetch<string | { reference?: string }>(`/companies/${encode(companyId)}/references${query}`, { method: 'POST' })
    const reference = typeof result === 'string' ? result : result?.reference
    if (!reference) throw new Error('The server did not return a reference.')
    return reference
  }
}
