import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

type Row=Record<string,any>
const text=(v:any,n=12000)=>String(v??'').trim().slice(0,n)
const bounded=(v:any,min:number,max:number,fallback:number)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback}
const allowedWindows=new Set([0,30,90,365])
const dimensions=new Set(['overall','city','category','service','evidence','campaign','template'])
const experimentDimensions=new Set(['city','category','service','evidence','campaign','template'])
const experimentStatuses=new Set(['planning','running','paused','completed','cancelled'])
const csv=(v:any)=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}

async function refresh(s:any){const q=await s.rpc('refresh_skylight_sales_operating_system_staff',{p_tenant_id:TENANT_ID});if(q.error)throw q.error;return q.data}

export async function GET(req:Request){
  try{
    await requireStaff('/admin/skylight-sales/acquisition')
    const s=await createClient(),url=new URL(req.url),rawWindow=Number(url.searchParams.get('window')||90),windowDays=allowedWindows.has(rawWindow)?rawWindow:90,dimension=text(url.searchParams.get('dimension')||'campaign',40)
    if(!dimensions.has(dimension))throw new Error('Unsupported acquisition dimension.')
    const latest=await s.from('skylight_sales_acquisition_metrics').select('metric_date').eq('tenant_id',TENANT_ID).order('metric_date',{ascending:false}).limit(1).maybeSingle();if(latest.error)throw latest.error
    const metricDate=latest.data?.metric_date
    if(!metricDate)return new Response('metric_date,window_days,dimension_type,dimension_key,opportunities,research,contact_ready,drafted,sent,replied,positive_replies,meetings,proposals,won,lost,avg_score,paid_revenue_cents,campaign_spend_cents,cac_cents,roas_bps,reply_rate_bps,sample_maturity\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="skylight-acquisition-metrics.csv"','Cache-Control':'no-store'}})
    const q=await s.from('skylight_sales_acquisition_metrics').select('*').eq('tenant_id',TENANT_ID).eq('metric_date',metricDate).eq('window_days',windowDays).eq('dimension_type',dimension).order('sent_opportunities',{ascending:false}).order('opportunities',{ascending:false}).limit(5000);if(q.error)throw q.error
    const headers=['metric_date','window_days','dimension_type','dimension_key','opportunities','research_opportunities','contact_ready_opportunities','drafted_opportunities','sent_opportunities','replied_opportunities','positive_reply_opportunities','meeting_opportunities','proposal_opportunities','won_opportunities','lost_opportunities','avg_score','paid_revenue_cents','campaign_spend_cents','cac_cents','roas_bps','reply_rate_bps','sample_maturity']
    const lines=[headers.join(','),...(q.data||[]).map((r:Row)=>headers.map(h=>csv(r[h])).join(','))]
    return new Response(lines.join('\n')+'\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="skylight-acquisition-${dimension}-${windowDays||'all'}d.csv"`,'Cache-Control':'no-store'}})
  }catch(e:any){return NextResponse.json({error:text(e?.message||'Unable to export acquisition metrics.',2000)},{status:400})}
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/skylight-sales/acquisition'),userId=String(claims.sub),s=await createClient(),body=await req.json() as Row,action=text(body.action,80),now=new Date().toISOString()
    if(action==='refresh')return NextResponse.json({ok:true,data:await refresh(s),automatic_outreach:false,billing_authorization:false,public_ranking_effect:false})

    if(action==='save_settings'){
      const directional=bounded(body.min_sent_sample_directional,1,10000,10),mature=bounded(body.min_sent_sample_mature,2,100000,30)
      if(mature<directional)throw new Error('Mature sent-sample threshold must be at least the directional threshold.')
      const row={tenant_id:TENANT_ID,default_window_days:[30,90,365].includes(Number(body.default_window_days))?Number(body.default_window_days):90,min_segment_opportunities:bounded(body.min_segment_opportunities,1,10000,3),min_sent_sample_directional:directional,min_sent_sample_mature:mature,min_wins_for_cac:bounded(body.min_wins_for_cac,1,10000,3),experiment_planner_enabled:body.experiment_planner_enabled!==false,updated_by:userId,updated_at:now}
      const q=await s.from('skylight_sales_acquisition_settings').upsert(row,{onConflict:'tenant_id'});if(q.error)throw q.error
      await refresh(s)
      return NextResponse.json({ok:true,measurement_rules_only:true})
    }

    if(action==='save_spend'){
      const id=text(body.id,40),campaignId=text(body.campaign_id,40),spendDate=text(body.spend_date,20),amount=Number(body.amount)
      if(!campaignId)throw new Error('Campaign is required.')
      if(!/^\d{4}-\d{2}-\d{2}$/.test(spendDate))throw new Error('Valid spend date is required.')
      if(!Number.isFinite(amount)||amount<0||amount>100000000)throw new Error('Spend amount must be a valid non-negative dollar amount.')
      const campaign=await s.from('skylight_sales_campaigns').select('id').eq('tenant_id',TENANT_ID).eq('id',campaignId).maybeSingle();if(campaign.error)throw campaign.error;if(!campaign.data)throw new Error('Campaign is not available for this tenant.')
      const patch:Row={campaign_id:campaignId,spend_date:spendDate,amount_cents:Math.round(amount*100),source:'manual',note:text(body.note,1200)||null,updated_by:userId,updated_at:now}
      const q=id?await s.from('skylight_sales_campaign_spend').update(patch).eq('tenant_id',TENANT_ID).eq('id',id):await s.from('skylight_sales_campaign_spend').insert({tenant_id:TENANT_ID,...patch,created_by:userId})
      if(q.error)throw q.error
      await refresh(s)
      return NextResponse.json({ok:true,spend_is_staff_entered:true})
    }

    if(action==='delete_spend'){
      const id=text(body.id,40);if(!id)throw new Error('Spend entry is required.')
      const q=await s.from('skylight_sales_campaign_spend').delete().eq('tenant_id',TENANT_ID).eq('id',id);if(q.error)throw q.error
      await refresh(s)
      return NextResponse.json({ok:true})
    }

    if(action==='save_experiment'){
      const id=text(body.id,40),name=text(body.name,240),status=text(body.status||'planning',30),dimensionType=text(body.dimension_type,40),dimensionKey=text(body.dimension_key,500),campaignId=text(body.campaign_id,40),targetRaw=body.target_sample_size
      if(!name)throw new Error('Experiment name is required.')
      if(!experimentStatuses.has(status))throw new Error('Experiment status is invalid.')
      if(dimensionType&&!experimentDimensions.has(dimensionType))throw new Error('Experiment dimension is invalid.')
      if(dimensionType&&!dimensionKey)throw new Error('Choose or enter the segment key being measured.')
      if(campaignId){const c=await s.from('skylight_sales_campaigns').select('id').eq('tenant_id',TENANT_ID).eq('id',campaignId).maybeSingle();if(c.error)throw c.error;if(!c.data)throw new Error('Linked campaign is not available for this tenant.')}
      let target:number|null=null;if(targetRaw!==''&&targetRaw!=null)target=bounded(targetRaw,1,100000,10)
      const patch:Row={name,status,hypothesis:text(body.hypothesis,5000)||null,dimension_type:dimensionType||null,dimension_key:dimensionKey||null,campaign_id:campaignId||null,target_sample_size:target,notes:text(body.notes,5000)||null,result_summary:text(body.result_summary,5000)||null,updated_by:userId,updated_at:now}
      if(id){const existing=await s.from('skylight_sales_acquisition_experiments').select('id,started_at,ended_at').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle();if(existing.error)throw existing.error;if(!existing.data)throw new Error('Experiment was not found.');if(status==='running'&&!existing.data.started_at)patch.started_at=now;if(['completed','cancelled'].includes(status)&&!existing.data.ended_at)patch.ended_at=now;const q=await s.from('skylight_sales_acquisition_experiments').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);if(q.error)throw q.error}
      else{if(status==='running')patch.started_at=now;if(['completed','cancelled'].includes(status))patch.ended_at=now;const q=await s.from('skylight_sales_acquisition_experiments').insert({tenant_id:TENANT_ID,...patch,created_by:userId});if(q.error)throw q.error}
      return NextResponse.json({ok:true,automatic_enrollment:false,automatic_outreach:false})
    }

    if(action==='set_experiment_status'){
      const id=text(body.id,40),status=text(body.status,30);if(!id||!experimentStatuses.has(status))throw new Error('Valid experiment and status are required.')
      const existing=await s.from('skylight_sales_acquisition_experiments').select('id,started_at,ended_at').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle();if(existing.error)throw existing.error;if(!existing.data)throw new Error('Experiment was not found.')
      const patch:Row={status,updated_by:userId,updated_at:now};if(status==='running'&&!existing.data.started_at)patch.started_at=now;if(['completed','cancelled'].includes(status)&&!existing.data.ended_at)patch.ended_at=now;if(['planning','running','paused'].includes(status))patch.ended_at=null
      const q=await s.from('skylight_sales_acquisition_experiments').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);if(q.error)throw q.error
      return NextResponse.json({ok:true,automatic_enrollment:false,automatic_outreach:false})
    }

    return NextResponse.json({error:'Unsupported Sales 3.8 acquisition action.'},{status:400})
  }catch(e:any){return NextResponse.json({error:text(e?.message||'Unable to process acquisition action.',2000)},{status:400})}
}
