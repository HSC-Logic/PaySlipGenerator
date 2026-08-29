export const nextReference = (year: number, sequence: number) => `PAY-${year}-${String(sequence).padStart(4, '0')}`
export const generateReference = () => {
  const year = new Date().getFullYear()
  const key = `payment-slip-sequence-${year}`
  const sequence = Number(localStorage.getItem(key) || '0') + 1
  localStorage.setItem(key, String(sequence))
  return nextReference(year, sequence)
}
