import { describe, expect, it, vi } from 'vitest'
import { createBlankSlip } from '../utils/paymentDefaults'

const company = { id: 'c1', name: 'Acme', version: 1 }
const state = { companies: [] as unknown[], recipients: [] as unknown[] }
const saveCompany = vi.fn(async (value: object) => ({ ...value, version: 1 }))
const saveRecipient = vi.fn(async (value: object) => ({ ...value, version: 1 }))
const create = vi.fn(async () => ({ id: 'p1', version: 1 }))
vi.mock('./repositories/apiRepository', () => ({
  ApiCompanyRepository: class { list = async () => state.companies; save = saveCompany },
  ApiRecipientRepository: class { list = async () => state.recipients; save = saveRecipient },
  ApiPaymentRepository: class { nextReference = async () => 'PS-1'; create = create },
}))
const { findUnsavedQuickParts, saveQuickSlipParts } = await import('./cloudSave')

const filled = () => { const slip = createBlankSlip('LKR'); slip.company.name = 'Acme'; slip.recipient.name = 'Nimal'; return slip }

describe('quick slip cloud save', () => {
  it('creates the company when the slip needs one and keeps the recipient link', async () => {
    state.companies = []; state.recipients = []
    const result = await saveQuickSlipParts({ source: filled(), saveSlip: true, saveRecipient: true, saveCompany: false })
    expect(saveCompany).toHaveBeenCalledOnce(); expect(saveRecipient).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ id: 'p1', reference: 'PS-1', savedCompany: true, savedRecipient: true })
    expect(create.mock.calls[0]).toMatchObject([expect.anything(), expect.any(String), expect.any(String)])
  })
  it('saves nothing when nothing is chosen', async () => {
    vi.clearAllMocks(); state.companies = []; state.recipients = []
    const result = await saveQuickSlipParts({ source: filled(), saveSlip: false, saveRecipient: false, saveCompany: false })
    expect(result).toEqual({ savedCompany: false, savedRecipient: false }); expect(saveCompany).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled()
  })
  it('reuses an existing company and recipient by name', async () => {
    vi.clearAllMocks(); state.companies = [company]; state.recipients = [{ id: 'r1', name: 'nimal' }]
    const result = await saveQuickSlipParts({ source: filled(), saveSlip: true, saveRecipient: true, saveCompany: true })
    expect(saveCompany).not.toHaveBeenCalled(); expect(saveRecipient).not.toHaveBeenCalled()
    expect(result.savedCompany).toBe(false); expect(create.mock.calls[0]).toMatchObject([expect.anything(), 'c1', 'r1'])
  })
  it('reports which parts are unsaved', async () => {
    state.companies = [company]; state.recipients = []
    await expect(findUnsavedQuickParts(filled())).resolves.toEqual({ company: false, recipient: true, hasCompany: true })
  })
})
