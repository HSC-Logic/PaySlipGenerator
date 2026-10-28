import type { Company, CloudCompany, CloudDesign, CustomDesign, CloudPaymentRecord, CloudRecipient, PaymentSlip } from '../../types'
import { cachedLogo } from '../logos'
import { parseCustomDesign } from '../../utils/customDesigns'

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
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const withLogoWrite = <T extends Company>(company: T) => { const { logo, logoId, ...rest } = company; return { ...rest, ...logoWrite({ logo, logoId }) } }

export const companyToDto = (company: CloudCompany) => { const { id, archivedAt, createdAt, updatedAt, ...rest } = withLogoWrite(company); return rest }
export const recipientToDto = (recipient: CloudRecipient) => { const { id, archivedAt, createdAt, updatedAt, ...rest } = recipient; return rest }
/** Write body for slips: the server maps the full slip, ignoring client ids, timestamps and totals. */
export const slipToDto = (slip: PaymentSlip, companyId: string, recipientId?: string, expectedVersion?: number) => ({
  companyId, recipientId: recipientId || null, ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
  slip: { ...structuredClone(slip), company: withLogoWrite(slip.company) },
})

export const companyFromDto = (row: Record<string, any>): CloudCompany => ({
  id: row.id, name: text(row.name), address: text(row.address), telephone: text(row.telephone), email: text(row.email), registrationNumber: text(row.registrationNumber), logo: text(row.logo), logoId: text(row.logoId) || undefined,
  authorizedName: text(row.authorizedName), authorizedDesignation: text(row.authorizedDesignation), themeColor: text(row.themeColor) || '#0b1f3a', referencePrefix: text(row.referencePrefix) || 'PS',
  defaultCurrency: row.defaultCurrency || 'LKR', defaultPaperSize: row.defaultPaperSize || 'a4', defaultOrientation: row.defaultOrientation || 'portrait',
  showSliplyBranding: row.showSliplyBranding !== false, isDefault: Boolean(row.isDefault), archivedAt: row.archivedAt ?? null, version: version(row.version), createdAt: timestamp(row.createdAt) || undefined, updatedAt: timestamp(row.updatedAt) || undefined,
})
export const recipientFromDto = (row: Record<string, any>): CloudRecipient => ({
  id: row.id, name: text(row.name), identification: text(row.identification), role: text(row.role), address: text(row.address), email: text(row.email), telephone: text(row.telephone), archivedAt: row.archivedAt ?? null, version: version(row.version), createdAt: timestamp(row.createdAt) || undefined, updatedAt: timestamp(row.updatedAt) || undefined,
})
const importedTotalsOf = (value: unknown) => { const row = (value ?? {}) as Record<string, unknown>; const subtotal = amount(row.subtotal), finalTotal = amount(row.finalTotal); return { ...(subtotal === undefined ? {} : { subtotal }), ...(finalTotal === undefined ? {} : { finalTotal }) } }
export const recordFromDto = (row: Record<string, any>): CloudPaymentRecord => ({
  id: row.id, createdAt: timestamp(row.createdAt), updatedAt: timestamp(row.updatedAt), companyId: row.companyId, recipientId: row.recipientId ?? null, archivedAt: row.archivedAt ?? null, version: version(row.version),
  origin: typeof row.origin === 'string' ? row.origin : undefined, subtotal: amount(row.subtotal), finalTotal: amount(row.finalTotal),
  ...(row.referenceConflict === true ? { referenceConflict: true } : {}), ...(row.totalsDiffer === true ? { totalsDiffer: true, importedTotals: importedTotalsOf(row.importedTotals) } : {}),
  slip: { ...row.slip, items: row.slip?.items ?? [], adjustments: row.slip?.adjustments ?? [], company: { ...row.slip?.company, logo: text(row.slip?.company?.logo) } },
})

/** Designs are the flat `CustomDesign` plus `version` on writes; id and timestamps are server-owned. */
export const designToDto = (design: CustomDesign & { version?: number }) => ({ ...design, ...(design.version === undefined ? {} : { version: design.version }) })
/** Returns undefined for a row whose design fields are not valid, so one bad row cannot break the list. */
export const designFromDto = (row: Record<string, any>): CloudDesign | undefined => {
  const design = parseCustomDesign(row)
  const rowVersion = version(row.version)
  return design && typeof row.id === 'string' && rowVersion !== undefined ? { ...design, id: row.id, version: rowVersion, createdAt: timestamp(row.createdAt), updatedAt: timestamp(row.updatedAt) } : undefined
}
