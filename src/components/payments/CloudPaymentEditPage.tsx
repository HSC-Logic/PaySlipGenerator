import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import App from '../../App'
import type { CloudCompany, CloudPaymentRecord } from '../../types'
import { ApiCompanyRepository, ApiPaymentRepository } from '../../services/repositories/apiRepository'
import { resolveSlipLogo } from '../../services/logos'
import { useAuth } from '../../features/auth/AuthProvider'
import { showSliplyBranding } from '../../features/auth/entitlements'
const payments=new ApiPaymentRepository();const companies=new ApiCompanyRepository()
export function CloudPaymentEditPage(){const {id}=useParams();const auth=useAuth();const[record,setRecord]=useState<CloudPaymentRecord|null>(null);const[company,setCompany]=useState<CloudCompany|null>(null);const[error,setError]=useState('');useEffect(()=>{if(!id)return;Promise.all([payments.get(id),companies.list()]).then(async([value,list])=>{if(!value)throw new Error('Payment not found.');const slip=await resolveSlipLogo(value.slip);setRecord({...value,slip});setCompany(list.find(x=>x.id===value.companyId)||null)}).catch(e=>setError(e instanceof Error?e.message:'Could not load payment.'))},[id]);if(error)return <main className="route-state" role="alert">{error}</main>;if(!record)return <main className="route-state" role="status">Loading payment…</main>;return <App initialSlip={record.slip} cloudRecordId={record.id} cloudRecordVersion={record.version} cloudCompanyId={record.companyId} showBranding={showSliplyBranding(auth.plan,company?.showSliplyBranding??true)}/>} 
