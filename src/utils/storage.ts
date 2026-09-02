import type { Company, CurrencyCode, PageOrientation, PaperSize, PaymentMethod, PaymentSlip, TotalAdjustment } from '../types'

export const STORAGE_KEYS = {
  company: 'payment-slip-company',
  draft: 'payment-slip-draft',
  theme: 'payment-slip-theme',
  recovery: 'payment-slip-recovery-v1',
} as const

type RecordValue = Record<string, unknown>

export const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value)

export const safeParse = (value: string | null): unknown => {
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return null }
}

export const safeGet = (storage: Storage, key: string): string | null => {
  try { return storage.getItem(key) } catch { return null }
}

export const safeSet = (storage: Storage, key: string, value: string): boolean => {
  try { storage.setItem(key, value); return true } catch { return false }
}

export const safeRemove = (storage: Storage, key: string): boolean => {
  try { storage.removeItem(key); return true } catch { return false }
}

const text = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback
const numeric = (value: unknown, fallback: number | ''): number | '' => value === '' || (typeof value === 'number' && Number.isFinite(value)) ? value : fallback
const oneOf = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => typeof value === 'string' && values.includes(value as T) ? value as T : fallback

const companyFrom = (value: unknown, fallback: Company): Company | null => {
  if (!isRecord(value)) return null
  return {
    name: text(value.name, fallback.name), address: text(value.address, fallback.address), telephone: text(value.telephone, fallback.telephone),
    email: text(value.email, fallback.email), registrationNumber: text(value.registrationNumber, fallback.registrationNumber), logo: text(value.logo, fallback.logo),
    authorizedName: text(value.authorizedName, fallback.authorizedName), authorizedDesignation: text(value.authorizedDesignation, fallback.authorizedDesignation),
    themeColor: text(value.themeColor, fallback.themeColor),
  }
}

export const loadCompany = (storage: Storage, fallback: Company): Company => companyFrom(safeParse(safeGet(storage, STORAGE_KEYS.company)), fallback) ?? { ...fallback }

export const saveCompany = (storage: Storage, company: Company) => safeSet(storage, STORAGE_KEYS.company, JSON.stringify(company))

const adjustmentFrom = (value: unknown): TotalAdjustment | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string') return null
  return {
    id: value.id, label: value.label,
    kind: oneOf(value.kind, ['discount', 'tax', 'service', 'delivery', 'charge'] as const, 'charge'),
    mode: oneOf(value.mode, ['percentage', 'fixed'] as const, 'fixed'),
    value: numeric(value.value, ''),
  }
}

/** Loads current and legacy drafts. Newer optional fields are filled from the
 * supplied defaults; unknown fields are ignored. Core sections and items must
 * still have the expected runtime shape before a draft is accepted.
 */
const paymentSlipFrom = (value: unknown, defaults: PaymentSlip): PaymentSlip | null => {
  if (!isRecord(value) || !isRecord(value.company) || !isRecord(value.recipient) || !isRecord(value.payment) || !Array.isArray(value.items)) return null
  const company = companyFrom(value.company, defaults.company)
  if (!company) return null
  const items = value.items.map((item, index) => {
    if (!isRecord(item) || typeof item.description !== 'string') return null
    return {
      id: text(item.id, `${defaults.items[0]?.id ?? 'item'}-${index + 1}`),
      description: item.description,
      quantity: numeric(item.quantity, ''),
      rate: numeric(item.rate, ''),
    }
  })
  if (items.some(item => item === null)) return null
  const recipient = value.recipient
  const payment = value.payment
  const rawAdjustments = value.adjustments === undefined || value.adjustments === null ? [] : value.adjustments
  if (!Array.isArray(rawAdjustments)) return null
  const adjustments = rawAdjustments.map(adjustmentFrom)
  if (adjustments.some(item => item === null)) return null
  return {
    company,
    recipient: {
      name: text(recipient.name, defaults.recipient.name), identification: text(recipient.identification, defaults.recipient.identification), role: text(recipient.role, defaults.recipient.role),
      address: text(recipient.address, defaults.recipient.address), email: text(recipient.email, defaults.recipient.email), telephone: text(recipient.telephone, defaults.recipient.telephone),
    },
    payment: {
      date: text(payment.date, defaults.payment.date), reference: text(payment.reference, defaults.payment.reference), title: text(payment.title, defaults.payment.title),
      method: oneOf<PaymentMethod>(payment.method, ['Cash', 'Bank Transfer', 'Cheque', 'Other'], defaults.payment.method),
      bankName: text(payment.bankName, defaults.payment.bankName), transactionReference: text(payment.transactionReference, defaults.payment.transactionReference), notes: text(payment.notes, defaults.payment.notes),
      adjustment: numeric(payment.adjustment, defaults.payment.adjustment), currency: oneOf<CurrencyCode>(payment.currency, ['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD'], defaults.payment.currency),
      sealText: text(payment.sealText, defaults.payment.sealText), paperSize: oneOf<PaperSize>(payment.paperSize, ['a4', 'a5', 'b5', 'letter'], defaults.payment.paperSize),
      orientation: oneOf<PageOrientation>(payment.orientation, ['portrait', 'landscape'], defaults.payment.orientation),
    },
    items: items as PaymentSlip['items'],
    adjustments: adjustments as TotalAdjustment[],
  }
}

export const loadDraft = (storage: Storage, defaults: PaymentSlip): PaymentSlip | null => paymentSlipFrom(safeParse(safeGet(storage, STORAGE_KEYS.draft)), defaults)

export const saveDraft = (storage: Storage, slip: PaymentSlip) => safeSet(storage, STORAGE_KEYS.draft, JSON.stringify(slip))

export type RecoverySnapshot = { slip: PaymentSlip; baseline: PaymentSlip; savedAt: number }

export const loadRecovery = (storage: Storage, defaults: PaymentSlip): RecoverySnapshot | null => {
  const value = safeParse(safeGet(storage, STORAGE_KEYS.recovery))
  if (!isRecord(value) || value.version !== 1 || typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return null
  const slip = paymentSlipFrom(value.slip, defaults)
  const baseline = paymentSlipFrom(value.baseline, defaults)
  return slip && baseline ? { slip, baseline, savedAt: value.savedAt } : null
}

export const saveRecovery = (storage: Storage, slip: PaymentSlip, baseline: PaymentSlip, savedAt = Date.now()) => safeSet(storage, STORAGE_KEYS.recovery, JSON.stringify({ version: 1, savedAt, slip, baseline }))

export const clearRecovery = (storage: Storage) => safeRemove(storage, STORAGE_KEYS.recovery)

export const loadTheme = (storage: Storage): 'light' | 'dark' | null => {
  const value = safeGet(storage, STORAGE_KEYS.theme)
  return value === 'light' || value === 'dark' ? value : null
}

export const saveTheme = (storage: Storage, theme: 'light' | 'dark') => safeSet(storage, STORAGE_KEYS.theme, theme)
