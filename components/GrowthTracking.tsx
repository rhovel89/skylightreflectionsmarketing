'use client'

import { useEffect, type MouseEvent, type ReactNode } from 'react'

type GrowthEvent =
  | 'for_businesses_view'
  | 'claim_cta_click'
  | 'list_business_cta_click'
  | 'visibility_plan_click'
  | 'market_sponsorship_click'
  | 'marketing_review_click'
  | 'business_visibility_click'

type GrowthContext = {
  businessId?: string
  city?: string
  category?: string
  plan?: 'free' | 'verified' | 'featured' | 'pro' | 'sponsorship' | 'marketing_review'
  source?: string
  pagePath?: string
}

function send(eventType: GrowthEvent, context: GrowthContext = {}) {
  const body = JSON.stringify({
    event_type: eventType,
    business_id: context.businessId,
    city: context.city,
    category: context.category,
    plan: context.plan,
    source: context.source,
    page_path: context.pagePath || (typeof window !== 'undefined' ? window.location.pathname : undefined),
  })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/growth-track', new Blob([body], { type: 'application/json' }))
      return
    }
  } catch {}
  fetch('/api/growth-track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

export function GrowthTrackedLink({
  eventType,
  href,
  className,
  children,
  target,
  rel,
  ...context
}: GrowthContext & {
  eventType: GrowthEvent
  href: string
  className?: string
  children: ReactNode
  target?: string
  rel?: string
}) {
  function track(_: MouseEvent<HTMLAnchorElement>) {
    send(eventType, context)
  }
  return <a href={href} className={className} target={target} rel={rel} onClick={track}>{children}</a>
}

export function GrowthPageView({ eventType, ...context }: GrowthContext & { eventType: GrowthEvent }) {
  useEffect(() => {
    send(eventType, context)
  }, [eventType, context.businessId, context.city, context.category, context.plan, context.source, context.pagePath])
  return null
}
