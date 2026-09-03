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

type DecimalFraction = { numerator: bigint; denominator: bigint }
const decimalFraction = (value: number | ''): DecimalFraction => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return { numerator: 0n, denominator: 1n }
  const match = String(numeric).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  if (!match) return { numerator: 0n, denominator: 1n }
  const sign = match[1] ? -1n : 1n
  const fraction = match[3] || ''
  const exponent = Number(match[4] || 0)
  const scale = fraction.length - exponent
  let numerator = sign * BigInt(`${match[2]}${fraction}`)
  if (scale < 0) numerator *= 10n ** BigInt(-scale)
  return { numerator, denominator: scale > 0 ? 10n ** BigInt(scale) : 1n }
}
const roundedDivision = (numerator: bigint, denominator: bigint) => {
  const sign = numerator < 0n ? -1n : 1n
  const absolute = numerator < 0n ? -numerator : numerator
  return sign * ((absolute + denominator / 2n) / denominator)
}
const toMinorUnits = (value: number | '') => {
  const fraction = decimalFraction(value)
  return roundedDivision(fraction.numerator * 100n, fraction.denominator)
}
const fromMinorUnits = (value: bigint) => Number(value) / 100
const itemMinorUnits = (item: Pick<PaymentItem, 'quantity' | 'rate'>) => {
  const quantity = decimalFraction(item.quantity)
  const rate = decimalFraction(item.rate)
  return roundedDivision(quantity.numerator * rate.numerator * 100n, quantity.denominator * rate.denominator)
}

export const itemAmount = (item: Pick<PaymentItem, 'quantity' | 'rate'>) => fromMinorUnits(itemMinorUnits(item))
export const subtotal = (items: PaymentItem[]) => fromMinorUnits(items.reduce((sum, item) => sum + itemMinorUnits(item), 0n))
export const adjustmentAmount = (entry: TotalAdjustment, base: number) => {
  const baseMinor = toMinorUnits(base)
  const value = decimalFraction(entry.value)
  const amount = entry.mode === 'percentage' ? roundedDivision(baseMinor * value.numerator, value.denominator * 100n) : toMinorUnits(entry.value)
  return fromMinorUnits(entry.kind === 'discount' ? -amount : amount)
}
export const adjustmentsTotal = (entries: TotalAdjustment[], base: number) => fromMinorUnits(entries.reduce((sum, entry) => sum + toMinorUnits(adjustmentAmount(entry, base)), 0n))
export const calculatePaymentTotals = (items: PaymentItem[], adjustment: number | '', adjustments: TotalAdjustment[] = []) => {
  const itemAmounts = items.map(item => fromMinorUnits(itemMinorUnits(item)))
  const subtotalMinor = items.reduce((sum, item) => sum + itemMinorUnits(item), 0n)
  const base = fromMinorUnits(subtotalMinor)
  const adjustmentAmounts = adjustments.map(entry => adjustmentAmount(entry, base))
  const finalMinor = subtotalMinor + toMinorUnits(adjustment) + adjustmentAmounts.reduce((sum, amount) => sum + toMinorUnits(amount), 0n)
  return { itemAmounts, subtotal: base, adjustmentAmounts, final: fromMinorUnits(finalMinor) }
}
export const finalTotal = (items: PaymentItem[], adjustment: number | '', adjustments: TotalAdjustment[] = []) => {
  return calculatePaymentTotals(items, adjustment, adjustments).final
}
export const formatCurrency = (amount: number | '', currency: SupportedCurrency = 'LKR') => {
  const config = currencies[currency] || currencies.LKR
  const value = new Intl.NumberFormat(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0))
  return `${config.symbol} ${value}`
}
