'use client'

import { useState } from 'react'

export function AdminTakeNextTask() {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function takeNext() {
    setBusy(true)
    setStatus('Finding the next unassigned priority…')
    const response = await fetch('/api/admin/take-next', { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(String(body.error || 'No task could be claimed.'))
      setBusy(false)
      return
    }
    setStatus('Task claimed. Opening it…')
    window.location.href = String(body.href || '/admin/action-center?focus=mine')
  }

  return <div className="take-next-wrap">
    <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void takeNext()}>{busy ? 'Claiming…' : 'Take Next Task'}</button>
    {status ? <span role="status">{status}</span> : null}
  </div>
}
