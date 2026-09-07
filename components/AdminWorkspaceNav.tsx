'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getAdminWorkspace, getAdminWorkspaceActiveHref } from '@/lib/admin-workflows'

export function AdminWorkspaceNav(){
  const pathname=usePathname(),workspace=getAdminWorkspace(pathname)
  if(!workspace)return null
  const activeHref=getAdminWorkspaceActiveHref(pathname,workspace)
  return <div className="admin-workspace-context"><div className="admin-workspace-context-inner"><div className="admin-workspace-context-label"><span>Workspace</span><strong>{workspace.label}</strong></div><nav className="admin-workspace-context-tabs" aria-label={`${workspace.label} navigation`}>{workspace.items.map(item=><Link className={item.href===activeHref?'active':''} href={item.href} key={item.href}>{item.label}</Link>)}</nav></div></div>
}
