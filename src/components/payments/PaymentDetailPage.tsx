import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { CloudPaymentRecord } from '../../types'
import { PaymentSlipPreview } from '../preview/PaymentSlipPreview'
import { SupabasePaymentRepository } from '../../services/repositories/supabaseRepository'
import { createSimilarSlip } from '../../utils/similarSlip'
import { buildPdf, downloadPdfDocument, printPdfDocument } from '../../utils/pdf'
const repository=new SupabasePaymentRepository()
export function PaymentDetailPage(){const{id}=useParams();const[record,setRecord]=useState<CloudPaymentRecord|null>(null);const[error,setError]=useState('');useEffect(()=>{if(!id||!/^[0-9a-f-]{36}$/i.test(id))return setError('Invalid payment identifier.');repository.get(id).then(value=>value?setRecord(value):setError('Payment not found.')).catch(e=>setError(e instanceof Error?e.message:'Could not load payment.'))},[id]);return <main className="cloud-page"><Link to="/payments">← Payments</Link>{error?<p role="alert">{error}</p>:!record?<p role="status">Loading payment…</p>:<><div className="page-heading"><h1>{record.slip.payment.reference}</h1><div className="quick-actions"><Link className="button secondary" to={`/payments/${record.id}/edit`}>Edit</Link><Link className="button secondary" to="/payments/new" state={{slip:createSimilarSlip(record.slip,{reference:''})}}>Create similar</Link><button className="button secondary" onClick={()=>void downloadPdfDocument(buildPdf(record.slip),record.slip)}>Download PDF</button><button className="button secondary" onClick={()=>void printPdfDocument(buildPdf(record.slip))}>Print</button></div></div><PaymentSlipPreview slip={record.slip}/></>}</main>}
