import type { PaymentSlip } from '../types'
import { ApiCompanyRepository, ApiPaymentRepository } from './repositories/apiRepository'

const companies = new ApiCompanyRepository(), payments = new ApiPaymentRepository()

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
