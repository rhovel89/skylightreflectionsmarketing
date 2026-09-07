'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { findAdminLocation } from '@/lib/admin-navigation'
import { getAdminWorkspace, getAdminWorkspaceActiveHref } from '@/lib/admin-workflows'

type AdminView = 'focused' | 'full'
const STORAGE_KEY = 'central-local-pros-admin-view'

function workspaceKey(pathname:string){
  if(/^\/admin\/businesses\/[^/]+\/visibility/.test(pathname))return 'visibility'
  if(/^\/admin\/businesses\/[^/]+/.test(pathname))return 'business-detail'
  if(pathname.startsWith('/admin/skylight-sales')||pathname.startsWith('/admin/acquisition-research')||pathname.startsWith('/admin/prospects'))return 'sales'
  if(pathname.startsWith('/admin/skylight-operations')||pathname.startsWith('/admin/skylight-intake')||pathname.startsWith('/admin/skylight-services')||pathname.startsWith('/admin/skylight-invoices'))return 'client-work'
  if(pathname.startsWith('/admin/revenue')||pathname.startsWith('/admin/pricing')||pathname.startsWith('/admin/lead-buyers')||pathname.startsWith('/admin/lead-billing')||pathname.startsWith('/admin/subscriptions')||pathname.startsWith('/admin/sponsorships')||pathname.startsWith('/admin/skylight-eddm'))return 'money'
  if(pathname.startsWith('/admin/seo')||pathname.startsWith('/admin/data-quality')||pathname.startsWith('/admin/content-intelligence')||pathname.startsWith('/admin/inventory-expansion')||pathname.startsWith('/admin/search')||pathname.startsWith('/admin/guides')||pathname.startsWith('/admin/locations')||pathname.startsWith('/admin/categories'))return 'growth-seo'
  if(pathname.startsWith('/admin/businesses')||pathname.startsWith('/admin/submissions')||pathname.startsWith('/admin/claims')||pathname.startsWith('/admin/verification')||pathname.startsWith('/admin/edit-requests')||pathname.startsWith('/admin/business-media')||pathname.startsWith('/admin/reports'))return 'businesses'
  return 'admin'
}

export function AdminTopbar() {
  const pathname = usePathname()
  const location = findAdminLocation(pathname)
  const workspace = getAdminWorkspace(pathname)
  const activeHref = getAdminWorkspaceActiveHref(pathname, workspace)
  const activeWorkspaceItem = workspace?.items.find((item) => item.href === activeHref)
  const currentLabel = pathname === '/admin' ? 'Owner Control Center' : activeWorkspaceItem?.label ?? location?.item.label ?? 'Admin Workspace'
  const groupLabel = pathname === '/admin' ? 'Home' : workspace?.label ?? location?.group.label ?? 'Advanced Tool'
  const [view,setView]=useState<AdminView>('focused')

  useEffect(()=>{
    const saved=window.localStorage.getItem(STORAGE_KEY)
    const next:AdminView=saved==='full'?'full':'focused'
    setView(next)
    document.documentElement.dataset.adminView=next
  },[])

  useEffect(()=>{
    document.documentElement.dataset.adminPath=pathname
    document.documentElement.dataset.adminWorkspace=workspaceKey(pathname)
  },[pathname])

  function chooseView(next:AdminView){
    setView(next)
    window.localStorage.setItem(STORAGE_KEY,next)
    document.documentElement.dataset.adminView=next
  }

  return (
    <div className="admin-context-bar">
      <div className="admin-context-location">
        <Link href="/admin">Admin</Link>
        <span aria-hidden="true">/</span>
        <span>{groupLabel}</span>
        <span aria-hidden="true">/</span>
        <strong>{currentLabel}</strong>
      </div>
      <div className="admin-context-actions">
        <div className="admin-view-switch" aria-label="Admin detail level">
          <button type="button" className={view==='focused'?'active':''} aria-pressed={view==='focused'} onClick={()=>chooseView('focused')}>Focused</button>
          <button type="button" className={view==='full'?'active':''} aria-pressed={view==='full'} onClick={()=>chooseView('full')}>Full View</button>
          <span className="admin-view-help">Full View shows every advanced control</span>
        </div>
        <Link href="/admin/action-center">Priorities</Link>
        <Link href="/admin/notifications">Notifications</Link>
        <Link href="/">Public Site ↗</Link>
      </div>
    </div>
  )
}
