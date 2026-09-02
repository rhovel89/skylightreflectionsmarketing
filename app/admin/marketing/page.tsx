import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireSuperAdmin } from '@/lib/auth'
import { MarketingStudio } from '@/components/MarketingStudio'

export const dynamic = 'force-dynamic'

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  await requireSuperAdmin('/admin/marketing')
  const sp=await searchParams
  const s=await createClient()
  const [{data:locations,error:locationError},{data:categories,error:categoryError},{data:campaigns,error:campaignError},{data:publications,error:publicationError},{data:integrations,error:integrationError}]=await Promise.all([
    s.from('locations').select('id,name,type,county').eq('tenant_id',TENANT_ID).eq('is_active',true).order('name'),
    s.from('categories').select('id,name,slug,vertical').eq('tenant_id',TENANT_ID).eq('is_active',true).order('vertical').order('name'),
    s.from('marketing_campaigns').select('id,name,record_type,campaign_type,audience,status,market_location_id,category_id,market_name,category_name,format,eyebrow,headline,subheadline,cta_label,destination_url,phone,caption,creative_brief,qr_enabled,design_config,canva_design_id,canva_edit_url,canva_view_url,scheduled_for,published_at,created_at,updated_at').eq('tenant_id',TENANT_ID).order('updated_at',{ascending:false}).limit(80),
    s.from('marketing_publications').select('id,campaign_id,platform,status,scheduled_for,published_at,external_url,error_message,created_at').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(150),
    s.from('marketing_integration_accounts').select('provider,status,account_name,scopes,connected_at,metadata').eq('tenant_id',TENANT_ID),
  ])
  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app'
  const canvaClientConfigured=Boolean(process.env.CANVA_CLIENT_ID&&process.env.CANVA_CLIENT_SECRET)
  const metaClientConfigured=Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET)
  const canva=(integrations??[]).find((x:any)=>x.provider==='canva')
  const meta=(integrations??[]).find((x:any)=>x.provider==='meta')
  const message=typeof sp.canva==='string'?sp.canva:''
  return <>
    <div className="admin-page-head">
      <div><div className="kpi">Super Admin Marketing</div><h1>Public Marketing Control Center</h1><p className="muted">Create, save, reuse, schedule and export branded public marketing for Central Illinois Local Pros. External publishing is never assumed: Canva and social channels only become actionable after an authenticated integration is connected.</p></div>
      <span className="badge sponsored">Super Admin</span>
    </div>
    {message&&<div className={`notice ${message==='connected'?'success':'warn'}`}>Canva connection status: {message.replaceAll('-',' ')}.</div>}
    {(locationError||categoryError||campaignError||publicationError||integrationError)&&<div className="notice warn">Some Marketing Control Center data could not be loaded. {locationError?.message||categoryError?.message||campaignError?.message||publicationError?.message||integrationError?.message}</div>}
    <div className="stat-grid" style={{marginBottom:18}}>
      <div className="stat">Active Markets<strong>{(locations??[]).length}</strong></div>
      <div className="stat">Saved Campaigns<strong>{(campaigns??[]).filter((x:any)=>x.record_type==='campaign'&&x.status!=='archived').length}</strong></div>
      <div className="stat">Reusable Templates<strong>{(campaigns??[]).filter((x:any)=>x.record_type==='template'&&x.status!=='archived').length}</strong></div>
      <div className="stat">Canva<strong>{canva?.status==='connected'?'Connected':canvaClientConfigured?'Ready to Connect':'Credentials Needed'}</strong></div>
    </div>
    <MarketingStudio locations={(locations??[]) as any[]} categories={(categories??[]) as any[]} campaigns={(campaigns??[]) as any[]} publications={(publications??[]) as any[]} siteUrl={siteUrl} canvaClientConfigured={canvaClientConfigured} canvaConnection={(canva??null) as any} metaClientConfigured={metaClientConfigured} metaConnection={(meta??null) as any}/>
  </>
}
