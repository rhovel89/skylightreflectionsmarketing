'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminNotification } from '@/lib/admin-notifications'

export function AdminNotificationCenter({ initialItems }: { initialItems: AdminNotification[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState<'unread' | 'all'>('unread')
  const [status, setStatus] = useState('')
  const visible = useMemo(() => filter === 'unread' ? items.filter(item => !item.read) : items, [items, filter])
  const unread = items.filter(item => !item.read)

  async function setRead(keys: string[], read: boolean) {
    if (!keys.length) return
    setStatus(read ? 'Marking read…' : 'Marking unread…')
    const response = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: read ? 'read' : 'unread', keys }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setStatus(String(body.error || 'Notification state could not be updated.'))
    setItems(current => current.map(item => keys.includes(item.key) ? { ...item, read } : item))
    setStatus(read ? 'Marked read.' : 'Marked unread.')
    router.refresh()
  }

  return <>
    <div className="notification-toolbar admin-card">
      <div className="notification-filter-tabs">
        <button className={filter === 'unread' ? 'active' : ''} type="button" onClick={() => setFilter('unread')}>Unread <span>{unread.length}</span></button>
        <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>All <span>{items.length}</span></button>
      </div>
      <div className="admin-row-actions">
        <button className="btn btn-small btn-light" type="button" disabled={!unread.length} onClick={() => void setRead(unread.map(item => item.key), true)}>Mark All Read</button>
      </div>
    </div>

    <div className="notification-list">
      {visible.map(item => <article className={`notification-item ${item.tone} ${item.read ? 'read' : 'unread'}`} key={item.key}>
        <div className="notification-dot" aria-hidden="true" />
        <div className="notification-copy">
          <div className="notification-meta"><span>{item.kind.replaceAll('_', ' ')}</span><time>{formatTime(item.createdAt)}</time></div>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
          <div className="admin-row-actions">
            <Link className="btn btn-small btn-primary" href={item.href} onClick={() => { if (!item.read) void setRead([item.key], true) }}>Open</Link>
            <button className="btn btn-small btn-light" type="button" onClick={() => void setRead([item.key], !item.read)}>{item.read ? 'Mark Unread' : 'Mark Read'}</button>
          </div>
        </div>
      </article>)}
      {!visible.length ? <div className="notification-empty"><strong>{filter === 'unread' ? 'You are caught up.' : 'No current notifications.'}</strong><span>{filter === 'unread' ? 'New actionable work will appear here automatically.' : 'There are no current staff notifications to display.'}</span></div> : null}
    </div>
    {status ? <div className="admin-editor-status" role="status">{status}</div> : null}
  </>
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
