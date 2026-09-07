'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { findAdminLocation } from '@/lib/admin-navigation'
import { getAdminWorkspace, getAdminWorkspaceActiveHref } from '@/lib/admin-workflows'

export function AdminTopbar() {
  const pathname = usePathname()
  const location = findAdminLocation(pathname)
  const workspace = getAdminWorkspace(pathname)
  const activeHref = getAdminWorkspaceActiveHref(pathname, workspace)
  const activeWorkspaceItem = workspace?.items.find((item) => item.href === activeHref)
  const currentLabel = pathname === '/admin' ? 'Owner Control Center' : activeWorkspaceItem?.label ?? location?.item.label ?? 'Admin Workspace'
  const groupLabel = pathname === '/admin' ? 'Home' : workspace?.label ?? location?.group.label ?? 'Advanced Tool'

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
        <Link href="/admin/action-center">Priorities</Link>
        <Link href="/admin/notifications">Notifications</Link>
        <Link href="/">Public Site ↗</Link>
      </div>
    </div>
  )
}
