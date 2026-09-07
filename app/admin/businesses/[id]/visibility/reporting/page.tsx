import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { BusinessVisibilityReportingPanel } from '@/components/BusinessVisibilityReportingPanel'

export const dynamic='force-dynamic'
export const metadata={title:'Visibility Opportunity & Client Reporting | Central Illinois Local Pros',robots:{index:false,follow:false}}
type Row=Record<string,any>

export default async function Page({params}:{params:Promise<{id:string}>}){
  await requireStaff('/admin/businesses')
  const {id}=await params,s=await createClient()
  const businessQ=await s.from('businesses').select('id,name').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle()
  if(businessQ.error||!businessQ.data)notFound()
  const [snapshotsQ,recommendationsQ,reportsQ,evidenceQ,prospectQ]=await Promise.all([
    s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('generated_at',{ascending:false}).limit(50),
    s.from('business_visibility_recommendations').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(500),
    s.from('business_visibility_reports').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('created_at',{ascending:false}).limit(100),
    s.from('business_visibility_sales_evidence').select('id,source_table,source_record_id,status,approved_at,revoked_at').eq('tenant_id',TENANT_ID).eq('business_id',id).eq('source_table','business_visibility_recommendations').order('approved_at',{ascending:false}).limit(500),
    s.from('business_prospects').select('id').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  const errors=[snapshotsQ.error,recommendationsQ.error,reportsQ.error,evidenceQ.error,prospectQ.error].filter(Boolean)
  const business=businessQ.data as Row

  return <div className="admin-visibility-page">
    <div className="admin-page-head"><div><div className="kpi">Business Visibility Intelligence 4.3</div><h1>{String(business.name)} · Opportunity & Reporting</h1><p className="muted">Turn measured visibility gaps into transparent recommendations and snapshot-stable prospect/client reports. Missing evidence is excluded rather than scored as zero, and Sales evidence still requires explicit approval.</p></div><div className="admin-head-badge-stack"><span className="badge verified">Snapshot-Stable</span><span className="badge neutral">Human Approval</span></div></div>
    {errors.length?<div className="notice warn">Some reporting records could not be loaded. Missing measurements are never converted to zero or treated as completed work.</div>:null}
    <BusinessVisibilityReportingPanel
      business={{id:String(business.id),name:String(business.name)}}
      snapshots={(snapshotsQ.data||[]) as Row[]}
      recommendations={(recommendationsQ.data||[]) as Row[]}
      reports={(reportsQ.data||[]) as Row[]}
      salesEvidence={(evidenceQ.data||[]) as Row[]}
      prospectLinked={Boolean(prospectQ.data?.id)}
    />
  </div>
}
