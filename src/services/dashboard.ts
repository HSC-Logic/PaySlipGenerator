import { apiFetch } from './api/client'
export type DashboardSummary={currentMonth:number;draft:number;pending:number;paid:number}
export const emptyDashboardSummary:DashboardSummary={currentMonth:0,draft:0,pending:0,paid:0}
const timeZone=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}}
export const normalizeSummary=(data:unknown):DashboardSummary=>{if(!data||typeof data!=='object')return emptyDashboardSummary;const v=data as Record<string,unknown>;return{currentMonth:Number(v.currentMonth)||0,draft:Number(v.draft)||0,pending:Number(v.pending)||0,paid:Number(v.paid)||0}}
export async function loadDashboardSummary():Promise<DashboardSummary>{return normalizeSummary(await apiFetch(`/dashboard/summary?tz=${encodeURIComponent(timeZone())}`))}
