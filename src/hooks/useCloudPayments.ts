import { useEffect, useState } from 'react'
import type { CloudPaymentRecord, PaymentSlipFilters } from '../types'
import { SupabasePaymentRepository } from '../services/repositories/supabaseRepository'
const repository = new SupabasePaymentRepository()
export function useCloudPayments(filters: PaymentSlipFilters = {}) { const [records,setRecords]=useState<CloudPaymentRecord[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const key=JSON.stringify(filters); useEffect(()=>{ let active=true; setLoading(true); repository.list(filters).then(data=>{if(active)setRecords(data)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not load payments.')}).finally(()=>{if(active)setLoading(false)}); return()=>{active=false} },[key]); return {records,loading,error,reload:()=>repository.list(filters).then(setRecords)} }
