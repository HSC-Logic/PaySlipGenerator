import type { Company, CloudCompany, CloudPaymentRecord, CloudRecipient, PaymentSlip } from '../../types'
import { cachedLogo } from '../logos'

const text = (value: unknown) => typeof value === 'string' ? value : ''
const timestamp = (value: unknown) => { const parsed = typeof value === 'number' ? value : Date.parse(String(value ?? '')); return Number.isFinite(parsed) ? parsed : 0 }
const version = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined

/**
 * A logo write is either a new `data:` URL or the id of an existing asset (never both). A data URL that is just the
 * fetched copy of the current `logoId` is sent as that id, so unchanged logos are not uploaded again.
 */
export const logoWrite = (company: Pick<Company, 'logo' | 'logoId'>): { logo?: string; logoId?: string } => {
  if (!company.logo) return {}
  if (company.logoId && company.logo === cachedLogo(company.logoId)) return { logoId: company.logoId }
  return company.logo.startsWith('data:') ? { logo: company.logo } : company.logoId ? { logoId: company.logoId } : {}
}
const withLogoWrite = <T extends Company>(company: T) => { const { logo, logoId, ...rest } = company; return { ...rest, ...logoWrite({ logo, logoId }) } }

export const companyToDto = (company: CloudCompany) => { const { id, archivedAt, ...rest } = withLogoWrite(company); return rest }
export const recipientToDto = (recipient: CloudRecipient) => { const { id, archivedAt, ...rest } = recipient; return rest }
/** Write body for slips: the server maps the full slip, ignoring client ids, timestamps and totals. */
export const slipToDto = (slip: PaymentSlip, companyId: string, recipientId?: string, expectedVersion?: number) => ({
  companyId, recipientId: recipientId || null, ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
  slip: { ...structuredClone(slip), company: withLogoWrite(slip.company) },
})

export const companyFromDto = (row: Record<string, any>): CloudCompany => ({
  id: row.id, name: text(row.name), address: text(row.address), telephone: text(row.telephone), email: text(row.email), registrationNumber: text(row.registrationNumber), logo: text(row.logo), logoId: text(row.logoId) || undefined,
  authorizedName: text(row.authorizedName), authorizedDesignation: text(row.authorizedDesignation), themeColor: text(row.themeColor) || '#0b1f3a', referencePrefix: text(row.referencePrefix) || 'PS',
  defaultCurrency: row.defaultCurrency || 'LKR', defaultPaperSize: row.defaultPaperSize || 'a4', defaultOrientation: row.defaultOrientation || 'portrait',
  showSliplyBranding: row.showSliplyBranding !== false, isDefault: Boolean(row.isDefault), archivedAt: row.archivedAt ?? null, version: version(row.version),
})
export const recipientFromDto = (row: Record<string, any>): CloudRecipient => ({
  id: row.id, name: text(row.name), identification: text(row.identification), role: text(row.role), address: text(row.address), email: text(row.email), telephone: text(row.telephone), archivedAt: row.archivedAt ?? null, version: version(row.version),
})
export const recordFromDto = (row: Record<string, any>): CloudPaymentRecord => ({
  id: row.id, createdAt: timestamp(row.createdAt), updatedAt: timestamp(row.updatedAt), companyId: row.companyId, recipientId: row.recipientId ?? null, archivedAt: row.archivedAt ?? null, version: version(row.version),
  slip: { ...row.slip, items: row.slip?.items ?? [], adjustments: row.slip?.adjustments ?? [], company: { ...row.slip?.company, logo: text(row.slip?.company?.logo) } },
})
