import { describe, expect, it } from 'vitest'
import { can, normalizePlan, showSliplyBranding } from './entitlements'
describe('entitlements', () => {
  it('fails safely to free', () => { expect(normalizePlan('owner')).toBe('free'); expect(can(undefined, 'cloudHistory')).toBe(false) })
  it('only allows verified pro branding preference', () => { expect(showSliplyBranding('free', false)).toBe(true); expect(showSliplyBranding('pro', false)).toBe(false) })
})
