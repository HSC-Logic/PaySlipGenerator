import { useCallback, useMemo, useState, type FormEvent } from 'react'
import type { CloudRecipient } from '../../types'
import { ApiRecipientRepository } from '../../services/repositories/apiRepository'
import { useRepositoryList } from '../../hooks/useRepositoryList'
import { Modal } from '../common/Modal'
const repository=new ApiRecipientRepository();const empty=():CloudRecipient=>({id:crypto.randomUUID(),name:'',identification:'',role:'',address:'',email:'',telephone:'',archivedAt:null});const mask=(value:string)=>value.length<5?'••••':`${value.slice(0,2)}${'•'.repeat(Math.min(6,value.length-4))}${value.slice(-2)}`
export function RecipientsPage(){
  const load=useCallback(()=>repository.list(),[])
  const{data,loading,error,reload}=useRepositoryList(load)
  const[draft,setDraft]=useState<CloudRecipient|null>(null)
  const[saving,setSaving]=useState(false)
  const[formError,setFormError]=useState('')
  const[query,setQuery]=useState('')
  const[message,setMessage]=useState('')
  const filtered=useMemo(()=>data.filter(x=>[x.name,x.role,x.email,x.telephone].some(v=>v.toLowerCase().includes(query.toLowerCase()))),[data,query])
  const editing=!!draft&&data.some(x=>x.id===draft.id)
  const set=(key:keyof CloudRecipient,value:string)=>setDraft(current=>current&&{...current,[key]:value})
  const close=()=>{setDraft(null);setFormError('');setSaving(false)}
  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(!draft)return
    const duplicate=data.find(x=>x.id!==draft.id&&x.name.trim().toLowerCase()===draft.name.trim().toLowerCase()&&x.email.trim().toLowerCase()===draft.email.trim().toLowerCase())
    if(duplicate&&!confirm('A recipient with the same normalized name and email exists. Save another record?'))return
    setSaving(true);setFormError('')
    try{await repository.save(draft);close();await reload();setMessage('Recipient saved.')}
    catch(x){setFormError(x instanceof Error?x.message:'Could not save recipient.');setSaving(false)}
  }
  return <main className="cloud-page">
    <div className="page-heading"><h1>Recipients</h1><button className="button primary" onClick={()=>{setMessage('');setDraft(empty())}}>Add recipient</button></div>
    <label>Search recipients<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
    {message&&<p role="status">{message}</p>}
    {loading?<p role="status">Loading recipients…</p>:error?<p role="alert">{error}</p>:filtered.length===0?<p className="empty-state">{data.length===0?'No recipients yet. Add one to reuse it on future payments.':'No recipients match your search.'}</p>:<ul className="cloud-list">{filtered.map(recipient=><li key={recipient.id}><button className="record-button" onClick={()=>{setMessage('');setDraft(recipient)}}><strong>{recipient.name}</strong><span>{recipient.role}</span>{recipient.identification&&<span>NIC: {mask(recipient.identification)}</span>}</button><button className="button danger-subtle" onClick={()=>confirm(`Archive ${recipient.name}? Historical payments will remain unchanged.`)&&void repository.archive(recipient.id).then(reload)}>Archive</button></li>)}</ul>}
    {draft&&<Modal title={editing?'Edit recipient':'Add recipient'} onClose={close}>
      <form className="management-form modal-form" onSubmit={submit}>
        <label>Name<input required value={draft.name} onChange={e=>set('name',e.target.value)}/></label>
        <label>Role<input value={draft.role} onChange={e=>set('role',e.target.value)}/></label>
        <label>Email<input type="email" value={draft.email} onChange={e=>set('email',e.target.value)}/></label>
        <label>Telephone<input type="tel" value={draft.telephone} onChange={e=>set('telephone',e.target.value)}/></label>
        <label className="wide">Address<textarea value={draft.address} onChange={e=>set('address',e.target.value)}/></label>
        <label>NIC / identification<input value={draft.identification} onChange={e=>set('identification',e.target.value)}/></label>
        {formError&&<p role="alert" className="error wide">{formError}</p>}
        <div className="modal-actions wide"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={saving}>{saving?'Saving…':editing?'Update recipient':'Add recipient'}</button></div>
      </form>
    </Modal>}
  </main>
}
