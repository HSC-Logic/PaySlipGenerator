import { expect, it } from 'vitest'
import { defaultBlocks, moveBlock, parseBlocks } from './designerLayout'
import { parseCustomDesign } from './customDesigns'
import { createBasicSlip } from '../test/fixtures/paymentSlips'
import { buildPdf } from './pdf'
it('clamps movement and rejects corrupt or duplicate sections',()=>{
  expect(moveBlock(defaultBlocks[0],-10,120)).toMatchObject({x:0,y:85})
  expect(parseBlocks(defaultBlocks)).toEqual(defaultBlocks)
  expect(parseBlocks([...defaultBlocks.slice(1),defaultBlocks[1]])).toBeUndefined()
  expect(parseBlocks(defaultBlocks.map(block=>({...block,x:NaN})))).toBeUndefined()
})
it('preserves layout snapshots and exports positioned sections',()=>{
  const design={name:'Movable',layout:'classic',color:'#123456',font:'helvetica',blocks:defaultBlocks}
  expect(parseCustomDesign(design)?.blocks).toEqual(defaultBlocks)
  const slip=createBasicSlip();slip.payment.customDesign=parseCustomDesign(design)
  const output=buildPdf(slip).output()
  expect(output).toContain('(Example Company)')
  expect(output).toContain('(PAYMENT SLIP)')
  expect(output).toContain(slip.payment.reference)
})
it('rejects overflowing content instead of exporting a clipped payment',()=>{
  const slip=createBasicSlip();slip.payment.customDesign={name:'Small',layout:'classic',color:'#123456',font:'helvetica',blocks:defaultBlocks.map(block=>block.id==='notes'?{...block,height:4}:block)}
  slip.payment.notes='Long note '.repeat(200)
  expect(()=>buildPdf(slip)).toThrow('Notes and bank details exceeds its box')
})
