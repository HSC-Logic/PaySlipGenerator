import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import type { DesignBlock, DesignBlockId, PaymentSlip } from '../../types'
import { blockLabels, blockText, moveBlock } from '../../utils/designerLayout'
import { buildPaymentSlipView } from '../../utils/paymentSlipView'
export function DesignerCanvas({slip,blocks,selected,onSelect,onMove,showBranding=true}:{slip:PaymentSlip;blocks:DesignBlock[];selected?:DesignBlockId;onSelect?:(id:DesignBlockId)=>void;onMove?:(block:DesignBlock)=>void;showBranding?:boolean}) {
  const view=buildPaymentSlipView(slip)
  const pointerDown=(event:PointerEvent<HTMLDivElement>,block:DesignBlock)=>{
    if(!onMove || (event.target as HTMLElement).closest('button'))return
    event.preventDefault();onSelect?.(block.id)
    const element=event.currentTarget, rect=element.parentElement!.getBoundingClientRect(), startX=event.clientX,startY=event.clientY
    element.setPointerCapture(event.pointerId)
    element.onpointermove=move=>onMove(moveBlock(block,block.x+(move.clientX-startX)/rect.width*100,block.y+(move.clientY-startY)/rect.height*100))
    const stop=()=>{element.onpointermove=null;element.onpointerup=null;element.onpointercancel=null}
    element.onpointerup=stop;element.onpointercancel=stop
  }
  const keyDown=(event:KeyboardEvent,block:DesignBlock)=>{if(!onMove || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=event.shiftKey?5:1;onMove(moveBlock(block,block.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),block.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)))}
  return <article className={`designer-paper ${onMove?'editable':''}`} aria-label="PDF design canvas" style={{aspectRatio:`${view.page.width}/${view.page.height}`,fontFamily:view.font==='times'?'Georgia, serif':view.font==='courier'?'Courier New, monospace':'Arial, sans-serif','--designer-accent':view.themeColor} as CSSProperties}>
    {blocks.map(block=><div key={block.id} className={`designer-block block-${block.id} ${selected===block.id?'selected':''}`} style={{left:`${block.x}%`,top:`${block.y}%`,width:`${block.width}%`,height:`${block.height}%`}} tabIndex={onMove?0:undefined} role={onMove?'button':undefined} aria-label={onMove?`Move ${blockLabels[block.id]}`:undefined} onFocus={()=>onSelect?.(block.id)} onPointerDown={event=>pointerDown(event,block)} onKeyDown={event=>keyDown(event,block)}>
      {block.id==='items'?<table><thead><tr>{['#','Description','Qty','Rate','Amount'].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{view.items.map(item=><tr key={item.id}>{[item.index,item.description,item.quantity,item.rate,item.amount].map((text,index)=><td key={index}>{text}</td>)}</tr>)}</tbody></table>:<>{block.id==='company' && view.company.logo && <img className="designer-logo" src={view.company.logo} alt="Company logo"/>}{blockText(slip,block.id)}</>}
    </div>)}
    {showBranding&&<footer>Generated with Sliply</footer>}
  </article>
}
