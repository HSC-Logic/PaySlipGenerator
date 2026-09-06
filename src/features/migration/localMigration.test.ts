import { describe,expect,it } from 'vitest'
import { localMigrationDecision,rememberMigrationDecision } from './localMigration'
const storage=()=>{const values=new Map<string,string>();return{get length(){return values.size},clear:()=>values.clear(),getItem:(k:string)=>values.get(k)??null,key:(i:number)=>[...values.keys()][i]??null,removeItem:(k:string)=>{values.delete(k)},setItem:(k:string,v:string)=>{values.set(k,v)}} as Storage}
describe('local migration decisions',()=>{it('offers only when local data exists and a decision is absent',()=>{const s=storage();expect(localMigrationDecision(s)).toBe('skip');s.setItem('payment-slip-company','{}');expect(localMigrationDecision(s)).toBe('offer');rememberMigrationDecision(s,'skipped');expect(localMigrationDecision(s)).toBe('skip')})})
