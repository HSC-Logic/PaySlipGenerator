import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { CustomDesign, DesignBlock, DesignBlockId, PaymentSlip } from '../../types'
import { createBlankSlip } from '../../utils/paymentDefaults'
import { loadDraft, loadRecovery, paymentSlipFrom } from '../../utils/storage'
import { loadCustomDesigns, parseCustomDesign, saveCustomDesigns } from '../../utils/customDesigns'
import { blockLabels, defaultBlocks, moveBlock } from '../../utils/designerLayout'
import { buildPdf, downloadPdfDocument } from '../../utils/pdf'
import { DesignerCanvas } from './DesignerCanvas'
export function PdfDesignerPage(){
  const location=useLocation(),navigate=useNavigate()
  const [source]=useState<PaymentSlip>(()=>{const blank=createBlankSlip();return paymentSlipFrom((location.state as {slip?:PaymentSlip}|null)?.slip,blank)||loadRecovery(localStorage,blank)?.slip||loadDraft(localStorage,blank)||blank})
  const initial=parseCustomDesign(source.payment.customDesign)
  const [design,setDesign]=useState<CustomDesign>(()=>initial?{...initial,blocks:initial.blocks||structuredClone(defaultBlocks)}:{name:'My design',layout:'classic',color:source.company.themeColor,font:'helvetica',blocks:structuredClone(defaultBlocks)})
  const [page,setPage]=useState({paperSize:source.payment.paperSize,orientation:source.payment.orientation})
  const [saved,setSaved]=useState(loadCustomDesigns),[selected,setSelected]=useState<DesignBlockId>('company'),[message,setMessage]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false)
  const slip={...source,payment:{...source.payment,...page,customDesign:design}}
  const block=design.blocks!.find(item=>item.id===selected)!
  const update=(next:Partial<CustomDesign>)=>{setDesign(current=>({...current,...next}));setDirty(true)}
  const move=(next:DesignBlock)=>{setDesign(current=>({...current,blocks:current.blocks!.map(item=>item.id===next.id?next:item)}));setDirty(true)}
  useEffect(()=>{const before=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before)},[dirty])
  const save=()=>{const valid=parseCustomDesign(design);if(!valid)return setMessage('Enter a name up to 80 characters and valid positions.');const existing=saved.find(item=>item.name.toLowerCase()===valid.name.toLowerCase());if(existing&&!window.confirm(`Replace saved design “${existing.name}”?`))return;const next=existing?saved.map(item=>item===existing?valid:item):[...saved,valid];const error=saveCustomDesigns(next);setMessage(error||'Design saved in this browser. Select it under Advanced options in the payment editor.');if(!error){setSaved(next);setDirty(false)} }
  const back=()=>{if(dirty&&!window.confirm('Leave without saving this design?'))return;navigate((location.state as {returnTo?:string}|null)?.returnTo||'/guest',{state:{slip:source}})}
  return <main className="pdf-designer"><header className="designer-heading"><div><h1>PDF Designer</h1><p>Drag sections to position them. Arrow keys move a focused section; Shift moves faster.</p></div><div className="inline-actions"><button className="button secondary" onClick={back}>Back to payment</button><button className="button primary" onClick={save}>Save design</button><button className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await downloadPdfDocument(buildPdf(slip),slip);setMessage('PDF downloaded.')}catch(error){setMessage(error instanceof Error?error.message:'Could not export PDF.')}finally{setBusy(false)}}}>Export PDF</button></div></header>
    <div className="designer-workspace"><aside className="designer-controls"><label>Design name<input maxLength={80} value={design.name} onChange={e=>update({name:e.target.value})}/></label><label>Saved designs<select value="" onChange={e=>{const value=saved.find(item=>item.name===e.target.value);if(value&&(!dirty||window.confirm('Replace unsaved changes with this saved design?'))){setDesign({...value,blocks:value.blocks||structuredClone(defaultBlocks)});setDirty(false)}}}><option value="">Load a saved design</option>{saved.map(item=><option key={item.name}>{item.name}</option>)}</select></label>
    <label>Page size<select value={page.paperSize} onChange={e=>setPage({...page,paperSize:e.target.value as PaymentSlip['payment']['paperSize']})}>{['a4','a5','b5','letter'].map(size=><option key={size}>{size}</option>)}</select></label><label>Orientation<select value={page.orientation} onChange={e=>setPage({...page,orientation:e.target.value as 'portrait'|'landscape'})}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
    <label>Accent color<input type="color" value={design.color} onChange={e=>update({color:e.target.value})}/></label><label>Font<select value={design.font} onChange={e=>update({font:e.target.value as CustomDesign['font']})}><option value="helvetica">Sans serif</option><option value="times">Serif</option><option value="courier">Monospace</option></select></label>
    <label>Section<select value={selected} onChange={e=>setSelected(e.target.value as DesignBlockId)}>{Object.entries(blockLabels).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
    <div className="designer-position">{(['x','y','width','height'] as const).map(key=><label key={key}>{({x:'Left (%)',y:'Top (%)',width:'Width (%)',height:'Height (%)'})[key]}<input type="number" min={key==='width'?10:key==='height'?4:0} max={100} step={1} value={Math.round(block[key]*10)/10} onChange={e=>{const value=e.target.valueAsNumber;if(!Number.isFinite(value))return;const next={...block,[key]:value};next.width=Math.max(10,Math.min(100,next.width));next.height=Math.max(4,Math.min(97,next.height));move(moveBlock(next,next.x,next.y))}}/></label>)}</div>
    <button className="button secondary" onClick={()=>{if(window.confirm('Reset all section positions?'))update({blocks:structuredClone(defaultBlocks)})}}>Reset layout</button><p>One page. Resize sections to fit your content; export reports overflow. Saved designs can be used on future payments.</p>{message&&<p role="status">{message}</p>}</aside>
    <div className="designer-stage"><DesignerCanvas slip={slip} blocks={design.blocks!} selected={selected} onSelect={setSelected} onMove={move}/></div></div>
  </main>
}
