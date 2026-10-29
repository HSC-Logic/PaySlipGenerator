import { useCallback, useMemo, useState, type FormEvent } from 'react'
import type { CloudCompany, CurrencyCode, PageOrientation, PaperSize } from '../../types'
import { ApiCompanyRepository } from '../../services/repositories/apiRepository'
import { resolveCompanyLogo } from '../../services/logos'
import { normalizeLogo } from '../../utils/logoImage'
import { useRepositoryList } from '../../hooks/useRepositoryList'
import { useAuth } from '../../features/auth/AuthProvider'
import { can } from '../../features/auth/entitlements'
import { Modal } from '../common/Modal'
const repository=new ApiCompanyRepository()
const empty=():CloudCompany=>({id:crypto.randomUUID(),name:'',address:'',telephone:'',email:'',registrationNumber:'',logo:'',authorizedName:'',authorizedDesignation:'',themeColor:'#0b1f3a',referencePrefix:'PS',defaultCurrency:'LKR',defaultPaperSize:'a4',defaultOrientation:'portrait',showSliplyBranding:true,isDefault:false,archivedAt:null})
export function CompaniesPage(){
  const auth=useAuth()
  const load=useCallback(()=>repository.list(),[])
  const {data,loading,error,reload}=useRepositoryList(load)
  const [draft,setDraft]=useState<CloudCompany|null>(null)
  const [query,setQuery]=useState('')
  const [message,setMessage]=useState('')
  const [formError,setFormError]=useState('')
  const [saving,setSaving]=useState(false)
  const filtered=useMemo(()=>data.filter(x=>[x.name,x.address,x.email].some(v=>(v??'').toLowerCase().includes(query.toLowerCase()))),[data,query])
  const editing=!!draft&&data.some(x=>x.id===draft.id)
  const close=()=>{setDraft(null);setFormError('');setSaving(false)}
  const pickLogo=(file?:File)=>{if(file)normalizeLogo(file).then(logo=>setDraft(current=>current&&{...current,logo,logoId:undefined})).catch(x=>setFormError(x instanceof Error?x.message:'Could not use that logo.'))}
  const edit=(company:CloudCompany)=>{setMessage('');setDraft(company);void resolveCompanyLogo(company).then(full=>setDraft(current=>current&&current.id===full.id?full:current))}
  const set=(key:keyof CloudCompany,value:unknown)=>setDraft(current=>current&&{...current,[key]:value})
  const submit=async(e:FormEvent)=>{e.preventDefault();if(!draft)return;setSaving(true);setFormError('');try{await repository.save(draft);close();await reload();setMessage('Company saved.')}catch(x){setFormError(x instanceof Error?x.message:'Could not save company.');setSaving(false)}}
  return <main className="cloud-page">
    <div className="page-heading"><h1>Companies</h1><button className="button primary" onClick={()=>{setMessage('');setDraft(empty())}}>Add company</button></div>
    <p>Company edits do not rewrite historical payment snapshots.</p>
    <label>Search companies<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
    {message&&<p role="status">{message}</p>}
    {loading?<p role="status">Loading companies…</p>:error?<p role="alert">{error}</p>:filtered.length===0?<p className="empty-state">{data.length===0?'No companies yet. Add one to reuse it on future payments.':'No companies match your search.'}</p>:<ul className="cloud-list">{filtered.map(company=><li key={company.id}><button className="record-button" onClick={()=>edit(company)}><strong>{company.name}</strong><span>{company.isDefault?'Default':''}</span></button><button className="button danger-subtle" onClick={()=>confirm(`Archive ${company.name}? Historical payments will remain unchanged.`)&&void repository.archive(company.id).then(reload)}>Archive</button></li>)}</ul>}
    {draft&&<Modal title={editing?'Edit company':'Add company'} onClose={close}>
      <form className="management-form modal-form" onSubmit={submit}>
        <label>Name<input required value={draft.name} onChange={e=>set('name',e.target.value)}/></label>
        <label>Reference prefix<input required pattern="[A-Z0-9]+(-[A-Z0-9]+)*" value={draft.referencePrefix} onChange={e=>set('referencePrefix',e.target.value.toUpperCase())}/></label>
        <label className="wide">Address<textarea required value={draft.address} onChange={e=>set('address',e.target.value)}/></label>
        <label>Default currency<select value={draft.defaultCurrency} onChange={e=>set('defaultCurrency',e.target.value as CurrencyCode)}>{['LKR','USD','EUR','GBP','INR','AUD','CAD','SGD'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Paper size<select value={draft.defaultPaperSize} onChange={e=>set('defaultPaperSize',e.target.value as PaperSize)}>{['a4','a5','b5','letter'].map(x=><option key={x}>{x.toUpperCase()}</option>)}</select></label>
        <label>Orientation<select value={draft.defaultOrientation} onChange={e=>set('defaultOrientation',e.target.value as PageOrientation)}><option>portrait</option><option>landscape</option></select></label>
        <label>Logo<input type="file" accept="image/*" onChange={e=>{pickLogo(e.target.files?.[0]);e.target.value=''}}/>{draft.logo&&<span className="inline-actions"><img src={draft.logo} alt="Company logo" style={{maxHeight:48,maxWidth:120}}/><button type="button" className="text-button" onClick={()=>setDraft({...draft,logo:'',logoId:undefined})}>Remove logo</button></span>}</label>
        <label><input type="checkbox" checked={draft.isDefault} onChange={e=>set('isDefault',e.target.checked)}/> Default company</label>
        <label><input type="checkbox" checked={draft.showSliplyBranding} disabled={!can(auth.plan,'removeSliplyBranding')} onChange={e=>set('showSliplyBranding',e.target.checked)}/> Show “Generated with Sliply”</label>
        {formError&&<p role="alert" className="error wide">{formError}</p>}
        <div className="modal-actions wide"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={saving}>{saving?'Saving…':editing?'Update company':'Add company'}</button></div>
      </form>
    </Modal>}
  </main>
}
