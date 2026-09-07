import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { BusinessVisibilityGooglePanel } from '@/components/BusinessVisibilityGooglePanel'

export const dynamic='force-dynamic'
export const metadata={title:'Google Data Intelligence | Central Illinois Local Pros',robots:{index:false,follow:false}}
type Row=Record<string,any>

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params,s=await createClient()
  const businessQ=await s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle()
  if(businessQ.error||!businessQ.data)notFound()
  const [gscQ,gbpQ,keywordsQ,connectionsQ,importsQ]=await Promise.all([
    s.from('business_visibility_gsc_metrics').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('period_end',{ascending:false}).order('impressions',{ascending:false}).limit(1500),
    s.from('business_visibility_gbp_metrics').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('metric_date',{ascending:false}).limit(2000),
    s.from('business_visibility_gbp_search_keywords').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('month_start',{ascending:false}).limit(1000),
    s.from('business_visibility_google_connections').select('id,connection_type,status,scopes,search_console_property,gbp_account_name,gbp_location_name,gbp_location_title,last_sync_at,last_error,created_at,updated_at').eq('tenant_id',TENANT_ID).eq('business_id',id),
    s.from('business_visibility_google_import_batches').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('created_at',{ascending:false}).limit(50),
  ])
  const errors=[gscQ.error,gbpQ.error,keywordsQ.error,connectionsQ.error,importsQ.error].filter(Boolean)
  const business=businessQ.data as Row
  return <div className="admin-visibility-page">
    <div className="admin-page-head"><div><div className="kpi">Business Visibility Intelligence 4.2</div><h1>{String(business.name)} · Google-Owned Data</h1><p className="muted">Use authorized Search Console and Google Business Profile data to understand clicks, impressions, CTR, average position, profile actions and search terms. CSV import remains available when API credentials are not configured.</p></div><div className="admin-head-badge-stack"><span className="badge verified">First-Party Data</span><span className="badge neutral">Import or API</span></div></div>
    {errors.length?<div className="notice warn">Some Google-owned metrics could not be loaded. Missing values are shown as “Not measured” rather than zero.</div>:null}
    <BusinessVisibilityGooglePanel
      business={{id:String(business.id),name:String(business.name),website:business.website||null}}
      gscMetrics={(gscQ.data||[]) as Row[]}
      gbpMetrics={(gbpQ.data||[]) as Row[]}
      gbpKeywords={(keywordsQ.data||[]) as Row[]}
      connections={(connectionsQ.data||[]) as Row[]}
      imports={(importsQ.data||[]) as Row[]}
      apiConfigured={Boolean(process.env.GOOGLE_VISIBILITY_CLIENT_ID&&process.env.GOOGLE_VISIBILITY_CLIENT_SECRET&&process.env.GOOGLE_VISIBILITY_REFRESH_TOKEN)}
    />
  </div>
}
