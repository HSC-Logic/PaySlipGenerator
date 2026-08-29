import { describe, expect, it } from 'vitest'
import { numberToWords } from './amountInWords'
describe('amount in words', () => { it('supports Sri Lankan groupings', () => expect(numberToWords(12_345_678)).toBe('One Crore Twenty Three Lakh Forty Five Thousand Six Hundred and Seventy Eight Rupees Only')); it('supports cents and zero', () => { expect(numberToWords(0)).toBe('Zero Rupees Only'); expect(numberToWords(10.5)).toBe('Ten Rupees and Fifty Cents Only') }) })
