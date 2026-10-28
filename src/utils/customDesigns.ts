import { parseBlocks } from './designerLayout'
import type { CustomDesign } from '../types'

export const customDesignKey = 'payment-slip-custom-designs'
export function parseCustomDesign(value: unknown): CustomDesign | undefined {
  if (!value || typeof value !== 'object') return
  const design = value as CustomDesign
  if (typeof design.name !== 'string' || !design.name.trim() || design.name.length > 80 || !['classic', 'minimal', 'modern'].includes(design.layout) || !/^#[0-9a-f]{6}$/i.test(design.color) || !['helvetica', 'times', 'courier'].includes(design.font)) return
  if (design.blocks !== undefined && !parseBlocks(design.blocks)) return
  return { ...(design.blocks ? { blocks: parseBlocks(design.blocks) } : {}), name: design.name.trim(), layout: design.layout, color: design.color, font: design.font }
}
export function loadCustomDesigns(): CustomDesign[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(customDesignKey) || '[]'); return Array.isArray(data) ? data.flatMap(value => { const design = parseCustomDesign(value); return design ? [design] : [] }) : [] } catch { return [] }
}
export function saveCustomDesigns(designs: CustomDesign[]): string {
  try { localStorage.setItem(customDesignKey, JSON.stringify(designs)); return '' } catch { return 'Could not save designs in this browser. Free some storage or allow browser storage, then retry.' }
}

export const designForeground = (color: string) => { const rgb = [1, 3, 5].map(start => Number.parseInt(color.slice(start, start + 2), 16)); return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 155 ? '#0b1f3a' : '#ffffff' }
