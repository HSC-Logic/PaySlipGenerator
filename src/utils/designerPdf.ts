import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PaymentSlip } from '../types'
import { blockLabels, blockText } from './designerLayout'
import { buildPaymentSlipView } from './paymentSlipView'
export function buildDesignerPdf(slip: PaymentSlip, showBranding = true) {
  const view = buildPaymentSlipView(slip)
  const doc = new jsPDF({unit:'mm',format:slip.payment.paperSize,orientation:slip.payment.orientation})
  const {width,height} = view.page
  const blocks = slip.payment.customDesign!.blocks!
  for (const block of blocks) {
    const x=block.x*width/100, y=block.y*height/100, w=block.width*width/100, h=block.height*height/100
    if (block.id === 'items') {
      autoTable(doc,{startY:y,margin:{left:x,right:width-x-w,top:y,bottom:height-y-h},head:[['#','Description','Qty','Rate','Amount']],body:view.items.map(item=>[item.index,item.description,item.quantity,item.rate,item.amount]),styles:{font:view.font,fontSize:9,cellPadding:1.5,overflow:'linebreak'},headStyles:{fillColor:[235,240,246],textColor:[11,31,58]},theme:'plain',pageBreak:'avoid'})
      const bottom=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY
      if(doc.getNumberOfPages()>1 || bottom>y+h+.1) throw new Error('Items table exceeds its box. Increase its height or use a larger page.')
    } else {
      let textX=x, textWidth=w
      if(block.id==='company' && view.company.logo){const box=Math.min(w*.12,h*.7);const image=doc.getImageProperties(view.company.logo);const ratio=image.width/image.height;const imageWidth=ratio>=1?box:box*ratio,imageHeight=ratio>=1?box/ratio:box;doc.addImage(view.company.logo,view.company.logoFormat,x,y,imageWidth,imageHeight);textX+=box+w*.02;textWidth-=box+w*.02}
      const size=block.id==='heading'?18:block.id==='company'?12:9
      doc.setFont(view.font,block.id==='heading'||block.id==='company'?'bold':'normal');doc.setFontSize(size)
      // ponytail: fixed-size sections; reject overflow. Add pagination when multi-page free layouts are needed.
      const lines=doc.splitTextToSize(blockText(slip,block.id),textWidth) as string[]
      if(lines.length*size*.352778*1.15>h) throw new Error(`${blockLabels[block.id]} exceeds its box. Increase its width or height.`)
      doc.setTextColor(block.id==='heading'||block.id==='company'?view.themeColor:'#263548')
      doc.text(lines,textX,y+size*.352778,{lineHeightFactor:1.15})
    }
  }
  if(showBranding){doc.setFont(view.font,'normal');doc.setFontSize(7);doc.setTextColor('#667085');doc.text('Generated with Sliply',width*.07,height*.985)}
  return doc
}
