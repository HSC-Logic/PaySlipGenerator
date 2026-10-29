import type { PaymentSlip } from '../types'
import { ApiCompanyRepository, ApiPaymentRepository, ApiRecipientRepository } from './repositories/apiRepository'

const companies = new ApiCompanyRepository(), payments = new ApiPaymentRepository(), recipients = new ApiRecipientRepository()

export interface CloudSaveInput { slip: PaymentSlip; recordId?: string; version?: number; preferredCompanyId?: string; reserveReference?: boolean }
export interface CloudSaveResult { id: string; reference: string; version?: number }

/** Saves the editor's slip to the Slipy cloud (the only place Pro documents are saved): picks the preferred, default or first company, reserves a reference for a new document, then creates or updates. */
export async function saveSlipToCloud({ slip, recordId = '', version, preferredCompanyId = '', reserveReference = false }: CloudSaveInput): Promise<CloudSaveResult> {
  const rows = await companies.list()
  const company = rows.find(row => row.id === preferredCompanyId) ?? rows.find(row => row.isDefault) ?? rows[0]
  if (!company) throw new Error('Add a company in your cloud account first, then save again.')
  const candidate = structuredClone(slip)
  if (reserveReference) candidate.payment.reference = await payments.nextReference(company.id)
  const result = recordId ? await payments.update(recordId, candidate, company.id, undefined, version) : await payments.create(candidate, company.id)
  return { id: result.id, reference: candidate.payment.reference, version: result.version }
}

export interface QuickSaveOptions { source: PaymentSlip; saveSlip: boolean; saveRecipient: boolean; saveCompany: boolean; preferredCompanyId?: string }
export interface QuickSaveResult extends Partial<CloudSaveResult> { savedCompany: boolean; savedRecipient: boolean }

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Which parts of a quick slip are not in the cloud yet, so the prompt only offers what can be saved. */
export async function findUnsavedQuickParts(slip: PaymentSlip, preferredCompanyId = '') {
  const [companyRows, recipientRows] = await Promise.all([companies.list(), recipients.list()])
  return {
    company: !companyRows.some(row => row.id === preferredCompanyId || sameName(row.name, slip.company.name)),
    recipient: !!slip.recipient.name.trim() && !recipientRows.some(row => sameName(row.name, slip.recipient.name)),
    hasCompany: companyRows.length > 0,
  }
}

/** Saves the chosen parts of a quick slip. A saved payment needs a company, so one is created from the slip when none exists. */
export async function saveQuickSlipParts({ source: slip, saveSlip, saveRecipient, saveCompany, preferredCompanyId = '' }: QuickSaveOptions): Promise<QuickSaveResult> {
  const companyRows = await companies.list()
  let company = companyRows.find(row => row.id === preferredCompanyId) ?? companyRows.find(row => sameName(row.name, slip.company.name))
  let savedCompany = false
  if (!company && (saveCompany || saveSlip)) {
    company = await companies.save({ ...slip.company, id: crypto.randomUUID(), referencePrefix: 'PS', defaultCurrency: slip.payment.currency, defaultPaperSize: slip.payment.paperSize, defaultOrientation: slip.payment.orientation, showSliplyBranding: true, isDefault: companyRows.length === 0, archivedAt: null })
    savedCompany = true
  }
  let recipientId: string | undefined
  let savedRecipient = false
  if (saveRecipient && slip.recipient.name.trim()) {
    const existing = (await recipients.list()).find(row => sameName(row.name, slip.recipient.name))
    if (existing) recipientId = existing.id
    else { recipientId = (await recipients.save({ ...slip.recipient, id: crypto.randomUUID(), archivedAt: null })).id; savedRecipient = true }
  }
  if (!saveSlip || !company) return { savedCompany, savedRecipient }
  const candidate = structuredClone(slip)
  candidate.payment.reference = await payments.nextReference(company.id)
  const result = await payments.create(candidate, company.id, recipientId)
  return { id: result.id, reference: candidate.payment.reference, version: result.version, savedCompany, savedRecipient }
}
