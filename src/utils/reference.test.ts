import { describe, expect, it } from 'vitest'
import { nextReference } from './reference'
describe('payment references', () => { it('uses the expected year and padded sequence', () => expect(nextReference(2026, 1)).toBe('PAY-2026-0001')); it('supports larger sequences', () => expect(nextReference(2026, 120)).toBe('PAY-2026-0120')) })
