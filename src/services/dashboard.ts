import { requireSupabase } from './supabase/client'
export type DashboardSummary={currentMonth:number;draft:number;pending:number;paid:number}
const empty:DashboardSummary={currentMonth:0,draft:0,pending:0,paid:0}
export async function loadDashboardSummary():Promise<DashboardSummary>{const{data,error}=await requireSupabase().rpc('payment_dashboard_summary');if(error)throw new Error(error.message);if(!data||typeof data!=='object')return empty;return{currentMonth:Number(data.currentMonth)||0,draft:Number(data.draft)||0,pending:Number(data.pending)||0,paid:Number(data.paid)||0}}
