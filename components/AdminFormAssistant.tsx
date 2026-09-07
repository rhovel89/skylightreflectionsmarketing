'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type ReviewItem={label:string;value:string}
type ReviewState={form:HTMLFormElement;submitter:HTMLElement|null;title:string;subtitle:string;confirmLabel:string;items:ReviewItem[]}|null

const HELP:Record<string,string>={
  status:'Published makes the listing visible immediately. Draft or Pending keeps it out of normal public discovery until you intentionally change it.',
  primary_category_id:'The primary category is the main directory classification for this business.',
  category_ids:'Optional additional categories should only describe services or products the business legitimately offers.',
  has_physical_location:'Check this only for a real office, storefront, restaurant, shop or service center. Service areas are managed separately.',
  source_url:'Use an official or otherwise legitimate source that supports the business information. This is provenance, not customer-facing verification.',
  source_name:'Describe the source plainly, such as Official business website or State licensing directory.',
  agreement_mode:'Use Service Defaults unless this specific proposal intentionally needs different agreement behavior.',
  discount:'Defaults to $0. Only enter a discount when you intentionally want to reduce the proposal total.',
  deposit_percent:'Optional percentage override. Leave blank to use the service defaults.',
  deposit_required:'Optional fixed deposit. A fixed amount overrides a percentage when the proposal logic applies it.',
  internal_note:'Private owner/admin note. This should not be treated as client-facing proposal copy.',
  expires_at:'Optional proposal expiration date. Leave blank when you do not want to set one.',
  proposed_start_date:'Optional proposed start date. Confirm availability before committing to a specific delivery date.',
}

const DEFAULTS:Record<string,string>={
  status:'Recommended default: Published',
  state:'Recommended default: IL',
  location_type:'Recommended default: Office',
  agreement_mode:'Recommended default: Use Service Defaults',
  discount:'Recommended default: $0',
}

function directControl(label:HTMLLabelElement){return label.querySelector('input,select,textarea') as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|null}
function cleanText(v:string){return v.replace(/\s+/g,' ').trim()}
function labelName(label:HTMLLabelElement,control:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement){
  const span=label.querySelector(':scope > span')
  if(span?.textContent)return cleanText(span.textContent)
  const first=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&cleanText(node.textContent||''))
  return cleanText(first?.textContent||control.name||'Field')
}
function displayValue(control:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement){
  if(control instanceof HTMLInputElement){
    if(control.type==='checkbox')return control.checked?'Yes':'No'
    if(control.type==='radio')return control.checked?(control.value||'Selected'):''
    if(control.type==='password'||control.type==='hidden'||control.type==='file')return ''
    return cleanText(control.value)
  }
  if(control instanceof HTMLSelectElement){
    const selected=[...control.selectedOptions].filter(o=>o.value).map(o=>cleanText(o.textContent||o.value))
    return selected.join(', ')
  }
  return cleanText(control.value)
}
function identify(pathname:string,form:HTMLFormElement){
  if(pathname==='/admin/businesses'&&form.querySelector('input[name="name"]')&&form.querySelector('select[name="primary_category_id"]'))return{
    title:'Review business before creating',subtitle:'Confirm the canonical listing, category, location and provenance before the existing create action runs.',confirmLabel:'Create Business',
  }
  if(pathname==='/admin/skylight-operations'&&form.querySelector('select[name="client_id"]')&&form.querySelector('input[name="title"]')&&form.querySelector('select[name="agreement_mode"]'))return{
    title:'Review proposal before creating',subtitle:'Confirm the client, commercial terms and line items. This review does not send the proposal; it only allows the existing create-proposal action to continue.',confirmLabel:'Create Proposal',
  }
  return null
}
function reviewItems(form:HTMLFormElement){
  const items:ReviewItem[]=[]
  const seen=new Set<Element>()
  for(const label of [...form.querySelectorAll('label')]){
    const control=directControl(label)
    if(!control||seen.has(control)||control.disabled)continue
    seen.add(control)
    const value=displayValue(control)
    if(!value&&!(control instanceof HTMLInputElement&&control.type==='checkbox'))continue
    const name=labelName(label,control)
    if(!name)continue
    items.push({label:name,value})
  }
  return items.slice(0,36)
}

export function AdminFormAssistant(){
  const pathname=usePathname()
  const bypass=useRef(new WeakSet<HTMLFormElement>())
  const [review,setReview]=useState<ReviewState>(null)

  useEffect(()=>{
    const annotate=()=>{
      for(const form of [...document.querySelectorAll<HTMLFormElement>('.admin-main form')]){
        const target=identify(pathname,form)
        if(!target)continue
        form.classList.add('admin-review-enabled')
        form.dataset.adminReview='required'
        for(const label of [...form.querySelectorAll<HTMLLabelElement>('label')]){
          const control=directControl(label)
          if(!control||control.type==='hidden')continue
          label.dataset.adminRequirement=control.required?'required':'optional'
          const field=control.name
          if(field&&DEFAULTS[field]&&displayValue(control))label.dataset.adminDefault=DEFAULTS[field]
          if(field&&HELP[field]&&!label.querySelector(':scope > .admin-field-assist')){
            const help=document.createElement('small')
            help.className='admin-field-assist'
            help.dataset.adminAssist='true'
            help.textContent=HELP[field]
            label.appendChild(help)
          }
        }
      }
    }
    annotate()
    const observer=new MutationObserver(()=>annotate())
    const main=document.querySelector('.admin-main')
    if(main)observer.observe(main,{childList:true,subtree:true})

    const onSubmit=(event:SubmitEvent)=>{
      const form=event.target instanceof HTMLFormElement?event.target:null
      if(!form)return
      const target=identify(pathname,form)
      if(!target)return
      if(bypass.current.has(form)){bypass.current.delete(form);return}
      if(!form.checkValidity()){form.reportValidity();return}
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const submitter=event.submitter instanceof HTMLElement?event.submitter:null
      setReview({form,submitter,title:target.title,subtitle:target.subtitle,confirmLabel:target.confirmLabel,items:reviewItems(form)})
    }
    document.addEventListener('submit',onSubmit,true)
    return()=>{observer.disconnect();document.removeEventListener('submit',onSubmit,true)}
  },[pathname])

  const confirm=()=>{
    if(!review)return
    const {form,submitter}=review
    bypass.current.add(form)
    setReview(null)
    if(submitter instanceof HTMLButtonElement||submitter instanceof HTMLInputElement)form.requestSubmit(submitter)
    else form.requestSubmit()
  }

  if(!review)return null
  return <div className="admin-review-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setReview(null)}}>
    <section className="admin-review-modal" role="dialog" aria-modal="true" aria-labelledby="admin-review-title">
      <div className="admin-review-head"><div><span>Review Before Saving</span><h2 id="admin-review-title">{review.title}</h2><p>{review.subtitle}</p></div><button type="button" className="admin-review-close" onClick={()=>setReview(null)} aria-label="Close review">×</button></div>
      <div className="admin-review-note"><strong>Nothing has been submitted yet.</strong> Go back if anything needs to be changed.</div>
      <div className="admin-review-list">{review.items.length?review.items.map((item,index)=><div className="admin-review-row" key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></div>):<div className="empty">No populated fields were available for the review summary.</div>}</div>
      <div className="admin-review-actions"><button type="button" className="btn btn-light" onClick={()=>setReview(null)}>Back to Edit</button><button type="button" className="btn btn-primary" onClick={confirm}>{review.confirmLabel}</button></div>
    </section>
  </div>
}
