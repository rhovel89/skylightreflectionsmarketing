import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { BusinessVisibilityMonitoringWorkbench } from '@/components/BusinessVisibilityMonitoringWorkbench'

export const dynamic='force-dynamic'
export const metadata={title:'Visibility Monitoring & Competitors | Central Illinois Local Pros',robots:{index:false,follow:false}}
type Row=Record<string,any>

export default async function Page({params}:{params:Promise<{id:string}>}){
  await requireStaff('/admin/businesses')
  const {id}=await params
  const s=await createClient()
  const businessResult=await s.from('businesses')
    .select('id,name,website,rating,review_count,address_text,source_name,source_url,source_checked_at')
    .eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle()
  if(businessResult.error||!businessResult.data)notFound()
  const business=businessResult.data as Row

  const [
    prospectResult,policyResult,auditsResult,targetsResult,rankingsResult,
    competitorsResult,competitorAuditsResult,competitorRankingsResult,alertsResult,evidenceResult
  ]=await Promise.all([
    s.from('business_prospects').select('id,business_name,category,city,status')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    s.from('business_visibility_monitoring_policies').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).maybeSingle(),
    s.from('business_visibility_audits').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).order('checked_at',{ascending:false}).limit(100),
    s.from('business_visibility_keyword_targets').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).eq('active',true).order('updated_at',{ascending:false}).limit(150),
    s.from('business_visibility_rankings').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).order('checked_at',{ascending:false}).limit(600),
    s.from('business_visibility_competitors').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(100),
    s.from('business_visibility_competitor_audits').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).order('checked_at',{ascending:false}).limit(300),
    s.from('business_visibility_competitor_rankings').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).order('checked_at',{ascending:false}).limit(800),
    s.from('business_visibility_alerts').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).order('last_seen_at',{ascending:false}).limit(250),
    s.from('business_visibility_sales_evidence').select('*')
      .eq('tenant_id',TENANT_ID).eq('business_id',id).order('approved_at',{ascending:false}).limit(250),
  ])

  const results=[prospectResult,policyResult,auditsResult,targetsResult,rankingsResult,competitorsResult,competitorAuditsResult,competitorRankingsResult,alertsResult,evidenceResult]
  const errors=results.map((r:any)=>r.error).filter(Boolean)

  return <div className="admin-visibility-page">
    <div className="admin-page-head"><div><div className="kpi">Business Visibility Intelligence 4.0</div><h1>{String(business.name)} · Monitoring & Competitors</h1><p className="muted">Watch website health, source-backed rankings, competitor movement and alerts over time. Competitor data stays separate from the business record, and missing measurements are never converted to zero.</p></div><div className="admin-head-badge-stack"><span className="badge verified">Source-Backed</span><span className="badge neutral">Human Reviewed</span></div></div>
    {errors.length?<div className="notice warn">Some monitoring records could not be loaded. Missing measurements are shown as “Not measured,” never as zero.</div>:null}
    <BusinessVisibilityMonitoringWorkbench
      business={{id:String(business.id),name:String(business.name),website:business.website||null,rating:business.rating??null,review_count:business.review_count??null}}
      prospect={(prospectResult.data||null) as Row|null}
      policy={(policyResult.data||null) as Row|null}
      audits={(auditsResult.data||[]) as Row[]}
      targets={(targetsResult.data||[]) as Row[]}
      rankings={(rankingsResult.data||[]) as Row[]}
      competitors={(competitorsResult.data||[]) as Row[]}
      competitorAudits={(competitorAuditsResult.data||[]) as Row[]}
      competitorRankings={(competitorRankingsResult.data||[]) as Row[]}
      alerts={(alertsResult.data||[]) as Row[]}
      salesEvidence={(evidenceResult.data||[]) as Row[]}
      brightLocalConfigured={Boolean(process.env.BRIGHTLOCAL_API_KEY)}
      pageSpeedConfigured={Boolean(process.env.GOOGLE_PAGESPEED_API_KEY)}
      scheduledMonitoringConfigured={Boolean(process.env.CRON_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY)}
    />
  </div>
}
