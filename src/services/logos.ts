import type { Company, PaymentSlip } from '../types'
import { apiDownload } from './api/client'

const pending = new Map<string, Promise<string>>()
const resolved = new Map<string, string>()
const ID = /^[0-9a-f-]{32,36}$/i

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(new Error('Could not read the logo.'))
  reader.readAsDataURL(blob)
})

/** Logo assets are immutable, so each id is fetched once (with the bearer token) and kept as a data: URL for the preview and jsPDF. */
export function fetchLogo(id: string): Promise<string> {
  const known = pending.get(id)
  if (known) return known
  if (!ID.test(id)) return Promise.reject(new Error('Invalid logo identifier.'))
  const request = apiDownload(`/logos/${id}`).then(({ blob }) => toDataUrl(blob)).then(url => { resolved.set(id, url); return url })
  pending.set(id, request)
  request.catch(() => pending.delete(id))
  return request
}

/** Synchronous lookup of an already fetched logo. */
export const cachedLogo = (id: string | undefined) => (id ? resolved.get(id) : undefined) ?? ''
export const rememberLogo = (id: string, dataUrl: string) => { resolved.set(id, dataUrl); pending.set(id, Promise.resolve(dataUrl)) }
export const clearLogoCache = () => { pending.clear(); resolved.clear() }

/** Fills `logo` from `logoId`; a logo that cannot be fetched simply renders as the initials placeholder. */
export async function resolveCompanyLogo<T extends Company>(company: T): Promise<T> {
  if (company.logo || !company.logoId) return company
  try { return { ...company, logo: await fetchLogo(company.logoId) } } catch { return company }
}
export async function resolveSlipLogo(slip: PaymentSlip): Promise<PaymentSlip> {
  const company = await resolveCompanyLogo(slip.company)
  return company === slip.company ? slip : { ...slip, company }
}
