import { describe, expect, it } from 'vitest'
import { chooseLogoEncoding, dataUrlBytes, fitWithin, LOGO_MAX_BYTES } from './logoImage'
const urlOfSize = (bytes: number) => `data:image/png;base64,${'A'.repeat(Math.ceil(bytes / 3) * 4)}`
describe('logo normalisation rules', () => {
  it('only shrinks, preserving aspect ratio, to at most 600 px', () => {
    expect(fitWithin(1200, 300)).toEqual({ width: 600, height: 150 })
    expect(fitWithin(300, 900)).toEqual({ width: 200, height: 600 })
    expect(fitWithin(120, 80)).toEqual({ width: 120, height: 80 })
  })
  it('measures decoded size of a base64 data URL', () => { expect(dataUrlBytes('data:image/png;base64,QUJD')).toBe(3); expect(dataUrlBytes('data:image/png;base64,QUI=')).toBe(2) })
  it('keeps a PNG within 512 KB without computing the JPEG', () => {
    const png = urlOfSize(1000); let called = false
    expect(chooseLogoEncoding(png, () => { called = true; return '' })).toBe(png); expect(called).toBe(false)
  })
  it('falls back to JPEG when the PNG is too large and rejects when that is too large as well', () => {
    const big = urlOfSize(LOGO_MAX_BYTES + 1000), small = 'data:image/jpeg;base64,QUJD'
    expect(chooseLogoEncoding(big, () => small)).toBe(small)
    expect(() => chooseLogoEncoding(big, () => big)).toThrow(/too detailed/)
  })
})
