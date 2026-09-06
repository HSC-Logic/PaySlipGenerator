import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import App from '../../App'
import type { CloudCompany, CloudPaymentRecord } from '../../types'
import { SupabaseCompanyRepository, SupabasePaymentRepository } from '../../services/repositories/supabaseRepository'
import { useAuth } from '../../features/auth/AuthProvider'
import { showSliplyBranding } from '../../features/auth/entitlements'
const payments=new SupabasePaymentRepository();const companies=new SupabaseCompanyRepository()
export function CloudPaymentEditPage(){const {id}=useParams();const auth=useAuth();const[record,setRecord]=useState<CloudPaymentRecord|null>(null);const[company,setCompany]=useState<CloudCompany|null>(null);const[error,setError]=useState('');useEffect(()=>{if(!id)return;Promise.all([payments.get(id),companies.list()]).then(([value,list])=>{if(!value)throw new Error('Payment not found.');setRecord(value);setCompany(list.find(x=>x.id===value.companyId)||null)}).catch(e=>setError(e instanceof Error?e.message:'Could not load payment.'))},[id]);if(error)return <main className="route-state" role="alert">{error}</main>;if(!record)return <main className="route-state" role="status">Loading payment…</main>;return <App initialSlip={record.slip} cloudRecordId={record.id} cloudCompanyId={record.companyId} showBranding={showSliplyBranding(auth.plan,company?.showSliplyBranding??true)}/>} 
