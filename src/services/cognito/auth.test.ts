import { describe, expect, it } from 'vitest'
import { planFromGroups } from './auth'

describe('planFromGroups', () => {
  it('grants Pro only for slipy-pro', () => {
    expect(planFromGroups(['slipy-pro'])).toBe('pro')
    expect(planFromGroups(['other:pro', 'pro', 'slipy-lapsed'])).toBe('free')
    expect(planFromGroups(undefined)).toBe('free')
  })
})
