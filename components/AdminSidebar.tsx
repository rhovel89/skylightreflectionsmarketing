'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_BRAND } from '@/lib/constants'
import {
  ADMIN_NAV_GROUPS,
  ADMIN_PRIMARY_NAV,
  ADMIN_TOOL_COUNT,
  adminPathOnly,
  isAdminHrefActive,
} from '@/lib/admin-navigation'

export function AdminSidebar() {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAllTools, setShowAllTools] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState<number | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {}
    for (const group of ADMIN_NAV_GROUPS) {
      state[group.id] = group.items.some((item) => isAdminHrefActive(pathname, item.href))
    }
    return state
  })

  useEffect(() => {
    const currentIsPrimary = ADMIN_PRIMARY_NAV.some((item) => isAdminHrefActive(pathname, item.href))
    if (!currentIsPrimary && pathname !== '/admin') setShowAllTools(true)
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    let active = true
    const load = async () => {
      const response = await fetch('/api/admin/notifications', { cache: 'no-store' }).catch(() => null)
      if (!response?.ok) return
      const body = await response.json().catch(() => ({}))
      if (active && Number.isFinite(Number(body.unreadCount))) setUnreadNotifications(Number(body.unreadCount))
    }
    void load()
    const timer = window.setInterval(load, 60000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [pathname])

  const normalized = query.trim().toLowerCase()
  const visibleGroups = useMemo(() => {
    if (!normalized) return ADMIN_NAV_GROUPS
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.keywords ?? ''} ${group.label}`.toLowerCase().includes(normalized),
      ),
    })).filter((group) => group.items.length)
  }, [normalized])

  const searching = normalized.length > 0

  return (
    <aside className={`admin-side ${menuOpen ? 'menu-open' : ''}`}>
      <div className="admin-side-inner">
        <div className="admin-brand-panel">
          <Link className="admin-brand-link" href="/admin">
            <div className="admin-brand-mark" aria-hidden="true">CLP</div>
            <div className="admin-brand-copy">
              <strong>{DEFAULT_BRAND.directory_name}</strong>
              <span>Owner Console</span>
            </div>
          </Link>
          <button
            className="admin-mobile-menu-toggle"
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-label="Toggle admin navigation"
          >
            {menuOpen ? '×' : '☰'}
          </button>
        </div>

        <div className="admin-side-content">
          <div className="admin-nav-label">Main</div>
          <nav className="admin-primary-nav" aria-label="Primary admin navigation">
            {ADMIN_PRIMARY_NAV.map((item) => (
              <Link className={isAdminHrefActive(pathname, item.href) ? 'active' : ''} href={item.href} key={item.href}>
                <span className="admin-primary-icon" aria-hidden="true">{item.icon}</span>
                <span className="admin-primary-copy">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
                <span className="admin-primary-arrow" aria-hidden="true">›</span>
              </Link>
            ))}
          </nav>

          <Link className={`admin-notification-link ${isAdminHrefActive(pathname, '/admin/notifications') ? 'active' : ''}`} href="/admin/notifications">
            <span><span aria-hidden="true">●</span> Notifications</span>
            <span className={`admin-notification-badge ${unreadNotifications === 0 ? 'zero' : ''}`}>
              {unreadNotifications === null ? '…' : unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          </Link>

          <div className="admin-nav-label admin-nav-label-tools">Find anything</div>
          <label className="admin-nav-search">
            <span className="admin-nav-search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setShowAllTools(true)}
              placeholder="Search admin tools…"
              aria-label="Search admin tools"
            />
            {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear navigation search">×</button> : null}
          </label>

          <button className={`admin-all-tools-toggle ${showAllTools || searching ? 'open' : ''}`} type="button" onClick={() => setShowAllTools((value) => !value)}>
            <span>
              <strong>All Tools</strong>
              <small>{ADMIN_TOOL_COUNT} options preserved</small>
            </span>
            <span aria-hidden="true">{showAllTools || searching ? '−' : '+'}</span>
          </button>

          {showAllTools || searching ? (
            <nav className="admin-nav" aria-label="All admin tools">
              {visibleGroups.map((group) => {
                const expanded = searching || Boolean(openGroups[group.id])
                return (
                  <section className="admin-nav-group" key={group.id}>
                    <button
                      type="button"
                      className="admin-nav-group-toggle"
                      onClick={() => setOpenGroups((value) => ({ ...value, [group.id]: !value[group.id] }))}
                      aria-expanded={expanded}
                      disabled={searching}
                    >
                      <span>
                        <strong>{group.label}</strong>
                        <small>{group.items.length}</small>
                      </span>
                      <span className={`admin-nav-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">⌄</span>
                    </button>
                    {expanded ? (
                      <div className="admin-nav-items">
                        {group.items.map((item) => (
                          <Link className={isAdminHrefActive(pathname, item.href) ? 'active' : ''} href={item.href} key={item.href}>
                            <span>{item.label}</span>
                            <span className="admin-nav-arrow" aria-hidden="true">›</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </section>
                )
              })}
              {!visibleGroups.length ? (
                <div className="admin-nav-empty">
                  <strong>No matching tools</strong>
                  <span>Try a broader search term.</span>
                </div>
              ) : null}
            </nav>
          ) : null}

          <div className="admin-side-footer">
            <div className="admin-owner-note">
              <strong>Owner mode</strong>
              <span>Team tools are saved under All Tools for whenever you add staff later.</span>
            </div>
            <Link className="admin-public-link" href="/">← View Public Site</Link>
            <form action="/auth/signout" method="post">
              <button className="admin-logout" type="submit">Log Out</button>
            </form>
            <div className="admin-side-footer-meta">Powered by {DEFAULT_BRAND.parent_brand_name}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
