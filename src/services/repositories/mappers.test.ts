import { describe, expect, it } from 'vitest'
import { createBasicSlip } from '../../test/fixtures/paymentSlips'
import type { CloudCompany } from '../../types'
import { rememberLogo } from '../logos'
import { companyFromDto, companyToDto, logoWrite, recordFromDto, slipToDto } from './mappers'

const company = (extra: Partial<CloudCompany> = {}): CloudCompany => ({ id: 'c1', name: 'Acme', address: 'Colombo', telephone: '', email: '', registrationNumber: '', logo: '', authorizedName: '', authorizedDesignation: '', themeColor: '#123456', referencePrefix: 'PS', defaultCurrency: 'LKR', defaultPaperSize: 'a4', defaultOrientation: 'portrait', showSliplyBranding: true, isDefault: false, archivedAt: null, ...extra })

describe('cloud mapping', () => {
  it('creates immutable snapshots and preserves document identity', () => {
    const slip = createBasicSlip(); slip.payment.documentType = 'other'; slip.payment.customDocumentType = 'Receipt'; slip.payment.method = 'Other'; slip.payment.customPaymentMethod = 'Wise'
    const dto = slipToDto(slip, 'company', 'recipient', 4); slip.company.name = 'Changed'
    expect(dto.slip.company.name).toBe('Example Company')
    expect(dto).toMatchObject({ companyId: 'company', recipientId: 'recipient', version: 4, slip: { payment: { documentType: 'other', customDocumentType: 'Receipt', method: 'Other', customPaymentMethod: 'Wise' } } })
  })
  it('omits the version on create and a missing recipient becomes null', () => { const dto = slipToDto(createBasicSlip(), 'company'); expect(dto).not.toHaveProperty('version'); expect(dto.recipientId).toBeNull() })
  it('sends a logo as a new data URL or an existing id, never both', () => {
    expect(logoWrite({ logo: '' })).toEqual({})
    expect(logoWrite({ logo: '', logoId: 'old' })).toEqual({})
    expect(logoWrite({ logo: 'data:image/png;base64,QUJD' })).toEqual({ logo: 'data:image/png;base64,QUJD' })
    rememberLogo('11111111-1111-1111-1111-111111111111', 'data:image/png;base64,RkVU')
    expect(logoWrite({ logo: 'data:image/png;base64,RkVU', logoId: '11111111-1111-1111-1111-111111111111' })).toEqual({ logoId: '11111111-1111-1111-1111-111111111111' })
    expect(logoWrite({ logo: 'data:image/png;base64,TkVX', logoId: '11111111-1111-1111-1111-111111111111' })).toEqual({ logo: 'data:image/png;base64,TkVX' })
  })
  it('keeps server-owned fields out of company writes and the concurrency version in', () => {
    const dto = companyToDto(company({ version: 3, logo: 'data:image/png;base64,QUJD', logoId: 'x', archivedAt: null })) as Record<string, unknown>
    expect(dto).not.toHaveProperty('id'); expect(dto).not.toHaveProperty('archivedAt'); expect(dto.version).toBe(3); expect(dto.logo).toBe('data:image/png;base64,QUJD'); expect(dto).not.toHaveProperty('logoId')
  })
  it('reads companies defensively and carries logoId without inlined bytes', () => {
    const read = companyFromDto({ id: 'c1', name: 'Acme', address: 'Colombo', logoId: 'l1', version: 2, showSliplyBranding: false, isDefault: true })
    expect(read).toMatchObject({ logo: '', logoId: 'l1', version: 2, showSliplyBranding: false, isDefault: true, referencePrefix: 'PS', defaultCurrency: 'LKR', archivedAt: null })
  })
  it('parses record timestamps from ISO strings or epoch numbers and tolerates missing lists', () => {
    const record = recordFromDto({ id: 'p1', createdAt: '2026-10-01T00:00:00Z', updatedAt: 1760000000000, companyId: 'c1', version: 7, slip: { company: { name: 'A', logoId: 'l1' }, recipient: {}, payment: {} } })
    expect(record).toMatchObject({ createdAt: Date.parse('2026-10-01T00:00:00Z'), updatedAt: 1760000000000, recipientId: null, archivedAt: null, version: 7 })
    expect(record.slip.items).toEqual([]); expect(record.slip.company).toMatchObject({ logo: '', logoId: 'l1' })
  })
})
