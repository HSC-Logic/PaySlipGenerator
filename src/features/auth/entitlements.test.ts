import { describe, expect, it } from 'vitest'
import { can, normalizePlan, showSliplyBranding } from './entitlements'
describe('entitlements', () => {
  it('fails safely to free', () => { expect(normalizePlan('owner')).toBe('free'); expect(can(undefined, 'cloud')).toBe(false); expect(can('owner', 'googleDrive')).toBe(false) })
  it('grants every capability to pro only', () => { for (const capability of ['cloud', 'removeSliplyBranding', 'googleDrive'] as const) { expect(can('free', capability)).toBe(false); expect(can('pro', capability)).toBe(true) } })
  it('only allows verified pro branding preference', () => { expect(showSliplyBranding('free', false)).toBe(true); expect(showSliplyBranding('pro', false)).toBe(false); expect(showSliplyBranding('pro', true)).toBe(true) })
})
