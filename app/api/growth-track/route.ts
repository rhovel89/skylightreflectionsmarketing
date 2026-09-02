import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const EVENTS = new Set([
  'for_businesses_view','claim_cta_click','list_business_cta_click','visibility_plan_click',
  'market_sponsorship_click','marketing_review_click','business_visibility_click',
])
const PLANS = new Set(['free','verified','featured','pro','sponsorship','marketing_review'])
const SOURCES = new Set(['for-businesses','pricing-grid','market-page','city-page','business-profile','contact','navigation'])
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>
    const eventType = text(body.event_type, 80)
    if (!EVENTS.has(eventType)) return NextResponse.json({ error: 'Invalid event.' }, { status: 400 })

    const pagePath = text(body.page_path, 400)
    if (pagePath && !pagePath.startsWith('/')) return NextResponse.json({ error: 'Invalid page path.' }, { status: 400 })
    const plan = text(body.plan, 40)
    if (plan && !PLANS.has(plan)) return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
    const source = text(body.source, 120)
    if (source && !SOURCES.has(source)) return NextResponse.json({ error: 'Invalid source.' }, { status: 400 })

    const s = await createClient()
    const { error } = await s.rpc('track_growth_event', {
      p_tenant_id: TENANT_ID,
      p_event_type: eventType,
      p_page_path: pagePath || null,
      p_business_id: text(body.business_id, 80) || null,
      p_city: text(body.city, 120) || null,
      p_category: text(body.category, 160) || null,
      p_plan: plan || null,
      p_source: source || null,
    })
    if (error) return NextResponse.json({ error: 'Event not accepted.' }, { status: 400 })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Invalid event.' }, { status: 400 })
  }
}
