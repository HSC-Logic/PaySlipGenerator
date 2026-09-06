import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../../test/fixtures/paymentSlips'
import { slipToRow } from './mappers'
describe('cloud mapping', () => { it('creates immutable company and recipient snapshots with calculated totals', () => { const slip = createBasicSlip(); const row = slipToRow(slip, 'user', 'company'); slip.company.name = 'Changed'; expect((row.company_snapshot as typeof slip.company).name).toBe('Example Company'); expect(row.final_total).toBe(3000) }) })
