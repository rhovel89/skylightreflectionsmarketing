import Link from 'next/link'
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

  return <div className="container" style={{padding:'24px 0 48px'}}>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
      <Link className="btn btn-light" href={`/admin/businesses/${id}`}>← Business Workspace</Link>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility`}>Google & SEO Visibility 4.1</Link>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/monitoring`}>Monitoring & Competitors 4.0</Link>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/google`}>Google-Owned Data 4.2</Link>
      <span className="btn btn-primary" aria-current="page">Opportunity & Reporting 4.3</span>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/execution`}>Execution & Outcomes 4.4</Link>
    </div>
    {errors.length?<div className="notice warn" style={{marginBottom:14}}>Some reporting records could not be loaded. Missing measurements are never converted to zero or treated as completed work.</div>:null}
    <BusinessVisibilityReportingPanel
      business={{id:String(businessQ.data.id),name:String(businessQ.data.name)}}
      snapshots={(snapshotsQ.data||[]) as Row[]}
      recommendations={(recommendationsQ.data||[]) as Row[]}
      reports={(reportsQ.data||[]) as Row[]}
      salesEvidence={(evidenceQ.data||[]) as Row[]}
      prospectLinked={Boolean(prospectQ.data?.id)}
    />
  </div>
}
