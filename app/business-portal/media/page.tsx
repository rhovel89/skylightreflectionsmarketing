import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { getOwnerData } from '@/lib/owner'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OwnerMediaUploadForm } from './OwnerMediaUploadForm'

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due']

type MediaAccess = {
  planName: string
  planSlug: string
  galleryLimit: number
  menuUpload: boolean
}

function related(value: any) {
  return Array.isArray(value) ? value[0] : value
}

async function getMediaAccess(s: any, businessId: string): Promise<MediaAccess> {
  const { data } = await s
    .from('subscriptions')
    .select('status,ends_at,updated_at,plans(name,slug,entitlements,is_active,sort_order)')
    .eq('business_id', businessId)
    .in('status', ACTIVE_SUBSCRIPTION_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(10)

  const now = Date.now()
  const current = (data ?? []).find((row: any) => {
    const plan = related(row.plans)
    const ends = row.ends_at ? new Date(row.ends_at).getTime() : null
    return plan?.is_active !== false && (!ends || ends > now)
  })
  const plan = current ? related((current as any).plans) : null
  const entitlements = plan?.entitlements ?? {}
  const rawLimit = Number(entitlements.max_gallery_images ?? 0)

  return {
    planName: plan?.name || 'Free',
    planSlug: plan?.slug || 'free',
    galleryLimit: Number.isFinite(rawLimit) ? Math.max(0, rawLimit) : 0,
    menuUpload: Boolean(entitlements.menu_upload),
  }
}

async function isRestaurantBusiness(s: any, businessId: string) {
  const { data } = await s
    .from('business_categories')
    .select('category_id,categories!inner(vertical,is_active)')
    .eq('business_id', businessId)
    .eq('categories.vertical', 'restaurant')
    .eq('categories.is_active', true)
    .limit(1)
  return Boolean(data?.length)
}

async function deleteMedia(fd: FormData) {
  'use server'
  const claims = await requireUser('/business-portal/media')
  const uid = String(claims.sub)
  const id = String(fd.get('id') || '')
  const slug = String(fd.get('business_slug') || '')
  const s = await createClient()
  const { data } = await s
    .from('business_media')
    .delete()
    .eq('id', id)
    .eq('submitted_by', uid)
    .select('storage_path')
    .maybeSingle()
  if (data?.storage_path) await s.storage.from('business-media').remove([data.storage_path])
  revalidatePath('/business-portal/media')
  if (slug) revalidatePath(`/business/${slug}`)
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const claims = await requireUser('/business-portal/media')
  const uid = String(claims.sub)
  const { businesses, s } = await getOwnerData('/business-portal/media')
  if (!businesses.length) {
    return <div className="card empty-rich"><h2>Claim a business first</h2><p className="muted">Media tools become available after staff approves a legitimate ownership claim.</p><Link className="btn btn-primary" href="/search">Find My Listing</Link></div>
  }

  const requested = typeof sp.business === 'string' ? sp.business : ''
  const b = businesses.find((x: any) => x.id === requested) ?? businesses[0]
  const switcher = businesses.length > 1
    ? <form className="portal-switcher" action="/business-portal/media" method="get"><label>Managing<select name="business" defaultValue={b.id}>{businesses.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn btn-light" type="submit">Switch Business</button></form>
    : <div className="portal-current"><span>Managing</span><strong>{b.name}</strong></div>

  const [access, restaurant, mediaResult] = await Promise.all([
    getMediaAccess(s, b.id),
    isRestaurantBusiness(s, b.id),
    s.from('business_media')
      .select('id,storage_path,media_type,mime_type,original_filename,alt_text,caption,status,approval_status,created_at,reviewed_at,review_notes,submitted_by')
      .eq('business_id', b.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  const data = mediaResult.data ?? []
  const galleryUsed = data.filter((m: any) => m.media_type === 'gallery' && ['pending', 'approved'].includes(m.approval_status) && ['pending', 'active'].includes(m.status)).length
  const galleryRemaining = Math.max(0, access.galleryLimit - galleryUsed)
  const canGallery = access.galleryLimit > 0
  const canMenu = restaurant && access.menuUpload

  return <div>
    {switcher}
    <div className="portal-section-head">
      <div>
        <div className="kpi">Plan-controlled visual content</div>
        <h2>Photos & Media — {b.name}</h2>
        <p className="muted">Upload legitimate business media. Every new upload stays pending until staff approves it for public display.</p>
      </div>
      <Link className="btn btn-light" href={`/business/${b.slug}`}>View Public Profile</Link>
    </div>

    <div className="grid grid-2" style={{ marginBottom: 18 }}>
      <div className="card">
        <div className="badges"><span className="badge neutral">{access.planName}</span>{canGallery && <span className="badge sponsored">{galleryUsed} / {access.galleryLimit} photos used</span>}</div>
        <h3>Showcase Photo Allowance</h3>
        {canGallery
          ? <><p className="muted">Your {access.planName} plan includes up to <strong>{access.galleryLimit} showcase photos</strong>. Pending photos count toward the limit so the cap cannot be bypassed while media is under review.</p><p className="small muted">{galleryRemaining} showcase photo slot{galleryRemaining === 1 ? '' : 's'} currently available.</p></>
          : <><p className="muted">Logo and cover-image tools remain available for your claimed listing. Showcase service photos unlock with Featured (5) or Pro (10).</p><Link className="btn btn-light" href={`/business-portal/subscription?business=${b.id}`}>View Exposure Plans</Link></>}
      </div>
      <div className="card">
        <div className="kpi">Restaurant benefit</div>
        <h3>Menu Upload</h3>
        {restaurant
          ? canMenu
            ? <p className="muted">Your plan includes one current restaurant menu file. Upload a PDF or menu image up to 12 MB. Replacing the menu does <strong>not</strong> use a showcase-photo slot.</p>
            : <><p className="muted">Restaurant menu upload is available on Featured and Pro. It is separate from the showcase-photo allowance.</p><Link className="btn btn-light" href={`/business-portal/subscription?business=${b.id}`}>Unlock Menu Upload</Link></>
          : <p className="muted">Menu upload appears automatically for listings categorized as restaurants. Other business types use the gallery to show services, work, products and locations.</p>}
      </div>
    </div>

    <OwnerMediaUploadForm
      businessId={b.id}
      canGallery={canGallery}
      canMenu={canMenu}
      defaultType={canGallery ? 'gallery' : 'logo'}
    />

    <div className="request-list" style={{ marginTop: 18 }}>
      {data.map((m: any) => <div className="card" key={m.id}>
        <div className="section-head compact-head">
          <div><span className={`badge ${m.approval_status === 'approved' ? 'verified' : m.approval_status === 'rejected' ? 'neutral' : 'sponsored'}`}>{m.approval_status}</span><h3>{m.media_type === 'gallery' ? 'Showcase photo' : m.media_type === 'menu' ? 'Restaurant menu' : m.media_type}</h3></div>
          <span className="small muted">{new Date(m.created_at).toLocaleDateString()}</span>
        </div>
        <p className="small muted">{m.original_filename || m.alt_text || m.caption || m.storage_path}{m.mime_type ? ` · ${m.mime_type}` : ''}</p>
        {m.caption && <p>{m.caption}</p>}
        {m.review_notes && <div className="notice warn">Staff note: {m.review_notes}</div>}
        {m.submitted_by === uid && <form action={deleteMedia}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="business_slug" value={b.slug} /><button className="btn btn-light">Remove Upload</button></form>}
      </div>)}
      {!data.length && <div className="empty">No media submitted yet.</div>}
    </div>
  </div>
}
