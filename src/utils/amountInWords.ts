const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const underThousand = (n: number): string => {
  if (n < 20) return ones[n]
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`
  return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` and ${underThousand(n % 100)}` : ''}`
}
const integerToWords = (value: number): string => {
  if (value < 1000) return underThousand(value)
  for (const [size, label] of [[10_000_000, 'Crore'], [100_000, 'Lakh'], [1000, 'Thousand']] as [number, string][]) {
    if (value >= size) { const quotient = Math.floor(value / size); const remainder = value % size; return `${integerToWords(quotient)} ${label}${remainder ? ` ${integerToWords(remainder)}` : ''}` }
  }
  return ''
}
export const numberToWords = (value: number, major = 'Rupee', minor = 'Cent'): string => {
  if (!Number.isFinite(value) || value < 0) return ''
  const rupees = Math.floor(value)
  const cents = Math.round((value - rupees) * 100)
  const majorLabel = (count: number) => `${major}${count === 1 ? '' : 's'}`
  const minorLabel = (count: number) => minor === 'Penny' ? (count === 1 ? 'Penny' : 'Pence') : `${minor}${count === 1 ? '' : 's'}`
  if (rupees === 0) return cents ? `Zero ${majorLabel(0)} and ${underThousand(cents)} ${minorLabel(cents)} Only` : `Zero ${majorLabel(0)} Only`
  return `${integerToWords(rupees)} ${majorLabel(rupees)}${cents ? ` and ${underThousand(cents)} ${minorLabel(cents)}` : ''} Only`
}
