// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { customDesignKey, designForeground, loadCustomDesigns, parseCustomDesign, saveCustomDesigns } from './customDesigns'
import { buildPdf } from './pdf'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { loadDraft, saveDraft } from './storage'
const design = { name: 'My design', layout: 'modern', color: '#123456', font: 'times' } as const
beforeEach(() => { const values = new Map<string,string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key,value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() }) })
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })
it('saves and reloads valid designs, rejects corrupt stored settings', () => {
  expect(saveCustomDesigns([design])).toBe('')
  expect(loadCustomDesigns()).toEqual([design])
  localStorage.setItem(customDesignKey, JSON.stringify([design, { ...design, font: 'invalid' }, { ...design, color: 'url(bad)' }]))
  expect(loadCustomDesigns()).toEqual([design])
  expect(parseCustomDesign({ ...design, name: ' ' })).toBeUndefined()
  localStorage.setItem(customDesignKey, '{bad')
  expect(loadCustomDesigns()).toEqual([])
})
it('reports storage failure without discarding saved designs', () => {
  saveCustomDesigns([design])
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(saveCustomDesigns([])).toContain('Could not save')
  expect(loadCustomDesigns()).toEqual([design])
})
it('preserves custom designs in drafts and PDF fonts', () => {
  const slip = createBasicSlip()
  slip.payment.customDesign = design
  saveDraft(localStorage, slip)
  expect(loadDraft(localStorage, createBasicSlip())?.payment.customDesign).toEqual(design)
  const output = buildPdf(slip).output()
  expect(output).toContain('(Example Company)')
  expect(output).toContain('/F9')
  expect(designForeground('#ffffff')).toBe('#0b1f3a')
  expect(designForeground('#000000')).toBe('#ffffff')
})
