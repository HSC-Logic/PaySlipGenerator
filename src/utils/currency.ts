import type { PaymentItem, TotalAdjustment } from '../types'

export const currencies = {
  LKR: { symbol: 'Rs.', locale: 'en-LK', major: 'Rupee', minor: 'Cent' },
  USD: { symbol: '$', locale: 'en-US', major: 'Dollar', minor: 'Cent' },
  EUR: { symbol: '€', locale: 'en-IE', major: 'Euro', minor: 'Cent' },
  GBP: { symbol: '£', locale: 'en-GB', major: 'Pound', minor: 'Penny' },
  INR: { symbol: '₹', locale: 'en-IN', major: 'Rupee', minor: 'Paise' },
  AUD: { symbol: 'A$', locale: 'en-AU', major: 'Australian Dollar', minor: 'Cent' },
  CAD: { symbol: 'C$', locale: 'en-CA', major: 'Canadian Dollar', minor: 'Cent' },
  SGD: { symbol: 'S$', locale: 'en-SG', major: 'Singapore Dollar', minor: 'Cent' },
} as const
export type SupportedCurrency = keyof typeof currencies

export const itemAmount = (item: Pick<PaymentItem, 'quantity' | 'rate'>) => Number(item.quantity || 0) * Number(item.rate || 0)
export const subtotal = (items: PaymentItem[]) => items.reduce((sum, item) => sum + itemAmount(item), 0)
export const adjustmentAmount = (entry: TotalAdjustment, base: number) => {
  const amount = entry.mode === 'percentage' ? base * Number(entry.value || 0) / 100 : Number(entry.value || 0)
  return entry.kind === 'discount' ? -amount : amount
}
export const adjustmentsTotal = (entries: TotalAdjustment[], base: number) => entries.reduce((sum, entry) => sum + adjustmentAmount(entry, base), 0)
export const finalTotal = (items: PaymentItem[], adjustment: number | '', adjustments: TotalAdjustment[] = []) => {
  const base = subtotal(items)
  return base + Number(adjustment || 0) + adjustmentsTotal(adjustments, base)
}
export const formatCurrency = (amount: number | '', currency: SupportedCurrency = 'LKR') => {
  const config = currencies[currency] || currencies.LKR
  const value = new Intl.NumberFormat(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0))
  return `${config.symbol} ${value}`
}
