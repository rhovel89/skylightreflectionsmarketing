'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getAdminWorkflowGuide, getAdminWorkspace } from '@/lib/admin-workflows'

export function AdminWorkflowGuide(){
  const pathname=usePathname()
  const workspace=getAdminWorkspace(pathname)
  const guide=getAdminWorkflowGuide(pathname,workspace)
  if(!workspace||!guide)return null
  return <div className="admin-owner-guide-shell"><section className="admin-owner-guide" aria-label={`${workspace.label} owner guide`}><div className="admin-owner-guide-copy"><span>{guide.eyebrow}</span><strong>{guide.title}</strong><p>{guide.body}</p></div><div className="admin-owner-guide-actions">{guide.actions.map((action,index)=><Link className={index===0?'primary':''} href={action.href} key={`${action.href}-${action.label}`}><b>{index+1}</b><span>{action.label}</span></Link>)}</div></section></div>
}
