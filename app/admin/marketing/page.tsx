import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireSuperAdmin } from '@/lib/auth'
import { MarketingStudio } from '@/components/MarketingStudio'

export const dynamic = 'force-dynamic'

// Super Admin-only public marketing workspace. Assets are created for review and are never auto-published.
export default async function Page(){
  await requireSuperAdmin('/admin/marketing')
  const s=await createClient()
  const [{data:locations,error:locationError},{data:categories,error:categoryError}]=await Promise.all([
    s.from('locations').select('name,type,county').eq('tenant_id',TENANT_ID).eq('is_active',true).order('name'),
    s.from('categories').select('name,slug,vertical').eq('tenant_id',TENANT_ID).eq('is_active',true).order('vertical').order('name'),
  ])
  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app'
  const canvaClientConfigured=Boolean(process.env.CANVA_CLIENT_ID&&process.env.CANVA_CLIENT_SECRET)
  return <>
    <div className="admin-page-head">
      <div><div className="kpi">Super Admin Marketing</div><h1>Public Marketing Studio</h1><p className="muted">Create branded flyers, social graphics and campaign copy to market Central Illinois Local Pros to consumers and local businesses. Assets are generated for review first and are never published automatically.</p></div>
      <span className="badge sponsored">Super Admin</span>
    </div>
    {(locationError||categoryError)&&<div className="notice warn">Some campaign targeting options could not be loaded. {locationError?.message||categoryError?.message}</div>}
    <div className="stat-grid" style={{marginBottom:18}}>
      <div className="stat">Active Markets<strong>{(locations??[]).length}</strong></div>
      <div className="stat">Active Categories<strong>{(categories??[]).length}</strong></div>
      <div className="stat">Asset Formats<strong>4</strong></div>
      <div className="stat">Canva Bridge<strong>{canvaClientConfigured?'API Client Set':'Handoff Ready'}</strong></div>
    </div>
    <MarketingStudio locations={(locations??[]) as any[]} categories={(categories??[]) as any[]} siteUrl={siteUrl} canvaClientConfigured={canvaClientConfigured}/>
  </>
}
