import type { DesignBlock, DesignBlockId, PaymentSlip } from '../types'
import { buildPaymentSlipView } from './paymentSlipView'
export const blockLabels: Record<DesignBlockId, string> = { company: 'Company', heading: 'Document title', recipient: 'Recipient', metadata: 'Reference and date', purpose: 'Payment purpose', items: 'Items table', totals: 'Totals', notes: 'Notes and bank details', signatures: 'Signatures' }
export const defaultBlocks: DesignBlock[] = [
  { id:'company', x:7,y:6,width:52,height:12 }, { id:'heading',x:62,y:6,width:31,height:12 },
  { id:'recipient',x:7,y:21,width:50,height:15 }, { id:'metadata',x:62,y:21,width:31,height:15 },
  { id:'purpose',x:7,y:38,width:86,height:8 }, { id:'items',x:7,y:48,width:86,height:20 },
  { id:'totals',x:55,y:70,width:38,height:12 }, { id:'notes',x:7,y:70,width:45,height:12 },
  { id:'signatures',x:7,y:86,width:86,height:8 },
]
export function parseBlocks(value: unknown): DesignBlock[] | undefined {
  if (!Array.isArray(value) || value.length !== defaultBlocks.length) return
  const ids = new Set<string>()
  for (const block of value) {
    if (!block || !Object.hasOwn(blockLabels, block.id) || ids.has(block.id)) return
    ids.add(block.id)
    if (![block.x,block.y,block.width,block.height].every(n => typeof n === 'number' && Number.isFinite(n)) || block.x < 0 || block.y < 0 || block.width < 10 || block.height < 4 || block.x + block.width > 100.001 || block.y + block.height > 97) return
  }
  return value.map(({id,x,y,width,height}) => ({id,x,y,width,height}))
}
export function moveBlock(block: DesignBlock, x: number, y: number): DesignBlock {
  return { ...block, x: Math.max(0,Math.min(100-block.width,x)), y:Math.max(0,Math.min(97-block.height,y)) }
}
export function blockText(slip: PaymentSlip, id: DesignBlockId): string {
  const view = buildPaymentSlipView(slip)
  switch(id) {
    case 'company': return [view.company.name,view.company.address,view.company.contacts,view.company.registration].filter(Boolean).join('\n')
    case 'heading': return view.payment.documentHeading
    case 'recipient': return ['PAYMENT TO',view.recipient.name,...view.recipient.details].join('\n')
    case 'metadata': return `REFERENCE: ${view.payment.reference}\nPAYMENT DATE: ${view.payment.date}\nPAYMENT METHOD: ${view.payment.method}`
    case 'purpose': return `PAYMENT FOR\n${view.payment.title}`
    case 'totals': return [`Subtotal: ${view.totals.subtotal}`, ...(view.totals.adjustment ? [`Adjustment: ${view.totals.adjustment}`] : []), ...view.totals.entries.map(entry=>`${entry.label}: ${entry.amount}`), `TOTAL: ${view.totals.final}`,view.totals.words].join('\n')
    case 'notes': return [view.payment.bankName && `BANK: ${view.payment.bankName}`,view.payment.transactionReference && `TRANSACTION: ${view.payment.transactionReference}`,view.payment.notes].filter(Boolean).join('\n')
    case 'signatures': return `${view.company.authorizedName || '________________'}\nPrepared by${view.company.authorizedDesignation ? ` · ${view.company.authorizedDesignation}` : ''}\nRecipient signature: ________________    Date: ________________`
    case 'items': return ''
  }
}
