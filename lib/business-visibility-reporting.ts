import { createHash } from 'node:crypto'

type Row=Record<string,any>
export type VisibilitySourceRef={table:string;id:string;checked_at:string|null;source_url:string|null;label:string}
export type RecommendationDraft={recommendation_key:string;category:string;priority:'low'|'medium'|'high'|'critical';title:string;finding:string;recommended_action:string;source_refs:VisibilitySourceRef[];source_fingerprint:string}

const num=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:null}
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n))
const round=(n:number,d=1)=>Number(n.toFixed(d))
const hash=(v:any)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex')
const dateOnly=(v:any)=>{if(!v)return null;const d=new Date(String(v));return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10)}
const ts=(v:any)=>{if(!v)return 0;const n=new Date(String(v)).getTime();return Number.isFinite(n)?n:0}
const avg=(values:(number|null)[])=>{const a=values.filter((v):v is number=>v!=null&&Number.isFinite(v));return a.length?a.reduce((s,v)=>s+v,0)/a.length:null}
const deltaPct=(current:number|null,previous:number|null)=>current==null||previous==null||previous===0?null:((current-previous)/previous)*100
const ref=(table:string,row:Row|undefined|null,label:string,urlField='source_url'):VisibilitySourceRef|null=>row?.id?{table,id:String(row.id),checked_at:String(row.checked_at||row.metric_date||row.period_end||row.month_start||row.last_seen_at||row.created_at||'')||null,source_url:row[urlField]?String(row[urlField]):null,label}:null
const uniqueRefs=(refs:(VisibilitySourceRef|null|undefined)[])=>{const out:VisibilitySourceRef[]=[];const seen=new Set<string>();for(const r of refs){if(!r)continue;const k=`${r.table}:${r.id}`;if(seen.has(k))continue;seen.add(k);out.push(r)}return out}
const recFingerprint=(key:string,refs:VisibilitySourceRef[])=>hash({key,refs:refs.map(r=>[r.table,r.id,r.checked_at])})
const rankingKey=(r:Row)=>[r.engine||'google',r.keyword,r.search_location,r.surface,r.device].map(x=>String(x||'').toLowerCase()).join('|')
const rankingWeakness=(r:Row):number|null=>{if(r.not_found)return 100;const p=num(r.position);if(p==null)return null;return p<=3?0:p<=10?35:p<=20?70:100}
const health=(r:Row|undefined|null)=>r?avg([num(r.technical_score),num(r.on_page_seo_score),num(r.performance_score)]):null
const prettyBand=(b:string)=>b==='very_high'?'Very high':b==='not_measured'?'Not measured':b.charAt(0).toUpperCase()+b.slice(1)

function latestRowsByKey(rows:Row[],keyFn:(r:Row)=>string,dateField='checked_at'){
  const groups=new Map<string,Row[]>()
  for(const r of rows){const k=keyFn(r);if(!k)continue;const a=groups.get(k)||[];a.push(r);groups.set(k,a)}
  for(const a of groups.values())a.sort((x,y)=>ts(y[dateField])-ts(x[dateField]))
  return groups
}

function gscPeriods(rows:Row[]){
  const summaries=rows.filter(r=>r.dimension_type==='summary').sort((a,b)=>String(b.period_end).localeCompare(String(a.period_end)))
  const dedup:Row[]=[];const seen=new Set<string>()
  for(const r of summaries){const k=`${r.period_start}|${r.period_end}`;if(seen.has(k))continue;seen.add(k);dedup.push(r)}
  if(dedup.length)return dedup
  const groups=new Map<string,Row[]>()
  for(const r of rows.filter(x=>x.dimension_type==='query')){const k=`${r.period_start}|${r.period_end}`;const a=groups.get(k)||[];a.push(r);groups.set(k,a)}
  return [...groups.entries()].map(([k,a])=>{const [period_start,period_end]=k.split('|');const clicks=a.reduce((s,r)=>s+Number(r.clicks||0),0),impressions=a.reduce((s,r)=>s+Number(r.impressions||0),0),weighted=a.reduce((s,r)=>s+Number(r.position||0)*Number(r.impressions||0),0);return {id:`derived:${k}`,period_start,period_end,dimension_type:'summary',clicks,impressions,ctr:impressions?clicks/impressions:0,position:impressions?weighted/impressions:null,checked_at:a[0]?.checked_at,source_url:a.find(r=>r.source_url)?.source_url||null,_derived:true}}).sort((a,b)=>String(b.period_end).localeCompare(String(a.period_end)))
}

function gbpWindows(rows:Row[]){
  const dates=rows.map(r=>dateOnly(r.metric_date)).filter((x):x is string=>Boolean(x)).sort()
  if(!dates.length)return null
  const end=new Date(`${dates[dates.length-1]}T00:00:00Z`),start=new Date(end);start.setUTCDate(start.getUTCDate()-29)
  const prevEnd=new Date(start);prevEnd.setUTCDate(prevEnd.getUTCDate()-1);const prevStart=new Date(prevEnd);prevStart.setUTCDate(prevStart.getUTCDate()-29)
  const iso=(d:Date)=>d.toISOString().slice(0,10),currentStart=iso(start),currentEnd=iso(end),previousStart=iso(prevStart),previousEnd=iso(prevEnd)
  const current=new Map<string,number>(),previous=new Map<string,number>()
  for(const r of rows){const d=String(r.metric_date||''),metric=String(r.metric||'unknown'),value=Number(r.metric_value||0);if(d>=currentStart&&d<=currentEnd)current.set(metric,(current.get(metric)||0)+value);else if(d>=previousStart&&d<=previousEnd)previous.set(metric,(previous.get(metric)||0)+value)}
  const actionNames=[...new Set([...current.keys(),...previous.keys()])].filter(x=>!x.toUpperCase().includes('IMPRESSION'))
  const chosen=actionNames.length?actionNames:[...new Set([...current.keys(),...previous.keys()])]
  const currentTotal=chosen.reduce((s,k)=>s+(current.get(k)||0),0),previousTotal=chosen.reduce((s,k)=>s+(previous.get(k)||0),0)
  return {currentStart,currentEnd,previousStart,previousEnd,current:Object.fromEntries(current),previous:Object.fromEntries(previous),chosen,currentTotal,previousTotal,change_pct:deltaPct(currentTotal,previousTotal)}
}

function latestRankingSets(rows:Row[]){
  const groups=latestRowsByKey(rows,rankingKey)
  const current:Row[]=[],previous:Row[]=[]
  for(const a of groups.values()){if(a[0])current.push(a[0]);if(a[1])previous.push(a[1])}
  const summarize=(a:Row[])=>{const found=a.filter(r=>!r.not_found&&num(r.position)!=null),weak=a.map(rankingWeakness).filter((x):x is number=>x!==null);return {tracked:a.length,found:found.length,not_found:a.filter(r=>r.not_found).length,top3:found.filter(r=>Number(r.position)<=3).length,top10:found.filter(r=>Number(r.position)<=10).length,average_position:found.length?round(found.reduce((s,r)=>s+Number(r.position),0)/found.length,1):null,opportunity_pct:weak.length?round(weak.reduce((s,v)=>s+v,0)/weak.length,1):null}}
  return {groups,current,previous,currentSummary:summarize(current),previousSummary:summarize(previous)}
}

function addRecommendation(list:RecommendationDraft[],draft:Omit<RecommendationDraft,'source_fingerprint'>){
  const refs=uniqueRefs(draft.source_refs)
  if(!refs.length)return
  list.push({...draft,source_refs:refs,source_fingerprint:recFingerprint(draft.recommendation_key,refs)})
}

export function buildVisibilityIntelligence(input:{business:Row;audits:Row[];rankings:Row[];competitorAudits:Row[];competitorRankings:Row[];alerts:Row[];gscMetrics:Row[];gbpMetrics:Row[];gbpKeywords:Row[]}){
  const {business}=input
  const audits=[...input.audits].sort((a,b)=>ts(b.checked_at)-ts(a.checked_at)),latestAudit=audits.find(r=>r.status==='completed')||null,previousAudit=audits.filter(r=>r.status==='completed')[1]||null
  const websiteHealth=health(latestAudit),previousWebsiteHealth=health(previousAudit)
  let websiteOpportunity:number|null=websiteHealth==null?null:clamp(100-websiteHealth)
  if(latestAudit?.indexable===false)websiteOpportunity=Math.max(websiteOpportunity??0,95)
  if(Number(latestAudit?.http_status||0)>=400)websiteOpportunity=Math.max(websiteOpportunity??0,90)

  const gsc=gscPeriods(input.gscMetrics),gscCurrent=gsc[0]||null,gscPrevious=gsc[1]||null
  const latestQueryEnd=gscCurrent?.period_end||input.gscMetrics.filter(r=>r.dimension_type==='query').reduce((m,r)=>String(r.period_end)>m?String(r.period_end):m,'')
  const queryRows=input.gscMetrics.filter(r=>r.dimension_type==='query'&&String(r.period_end)===String(latestQueryEnd))
  const queryImpressions=queryRows.reduce((s,r)=>s+Number(r.impressions||0),0)
  const queryOpportunityRows=queryRows.filter(r=>Number(r.impressions||0)>=10&&((Number(r.position||0)>=4&&Number(r.position||0)<=20)||(Number(r.position||0)>0&&Number(r.position||0)<=10&&Number(r.ctr||0)<0.03)))
  const opportunityImpressions=queryOpportunityRows.reduce((s,r)=>s+Number(r.impressions||0),0)
  const gscOpportunity=queryImpressions>0?round(clamp(opportunityImpressions/queryImpressions*100),1):null

  const ranks=latestRankingSets(input.rankings),rankingOpportunity=ranks.currentSummary.opportunity_pct

  const latestCompetitorAuditById=new Map<string,Row>()
  for(const r of [...input.competitorAudits].sort((a,b)=>ts(b.checked_at)-ts(a.checked_at))){const k=String(r.competitor_id||'');if(k&&!latestCompetitorAuditById.has(k)&&r.status==='completed')latestCompetitorAuditById.set(k,r)}
  const competitorHealths=[...latestCompetitorAuditById.values()].map(health).filter((x):x is number=>x!=null)
  const bestCompetitorHealth=competitorHealths.length?Math.max(...competitorHealths):null
  const auditGap=websiteHealth!=null&&bestCompetitorHealth!=null?clamp(bestCompetitorHealth-websiteHealth):null
  const ownRankMap=new Map(ranks.current.map(r=>[rankingKey(r),r]))
  const latestCompetitorRanks=new Map<string,Row>()
  for(const r of [...input.competitorRankings].sort((a,b)=>ts(b.checked_at)-ts(a.checked_at))){const k=`${r.competitor_id}|${rankingKey(r)}`;if(!latestCompetitorRanks.has(k))latestCompetitorRanks.set(k,r)}
  let rankComparisons=0,competitorOutranks=0
  for(const r of latestCompetitorRanks.values()){const own=ownRankMap.get(rankingKey(r));if(!own)continue;rankComparisons++;if((own.not_found&&!r.not_found)||(!own.not_found&&!r.not_found&&Number(r.position)<Number(own.position)))competitorOutranks++}
  const competitorRankGap=rankComparisons?competitorOutranks/rankComparisons*100:null
  const competitorOpportunity=auditGap==null?competitorRankGap:competitorRankGap==null?auditGap:Math.max(auditGap,competitorRankGap)

  const gbp=gbpWindows(input.gbpMetrics),gbpOpportunity=gbp&&gbp.previousTotal>0?round(clamp(Math.max(0,(gbp.previousTotal-gbp.currentTotal)/gbp.previousTotal*100)),1):null

  const components=[
    {key:'website',label:'Website health',weight:25,score:websiteOpportunity,detail:websiteHealth==null?'Not measured':`Latest measured website health ${round(websiteHealth,1)}/100.`},
    {key:'search_console',label:'Search Console query opportunity',weight:25,score:gscOpportunity,detail:gscOpportunity==null?'Not measured':`${round(opportunityImpressions,0)} of ${round(queryImpressions,0)} latest query impressions meet the evidence rules for position/CTR opportunity.`},
    {key:'rankings',label:'Tracked organic/local rankings',weight:25,score:rankingOpportunity,detail:rankingOpportunity==null?'Not measured':`${ranks.currentSummary.tracked} current source-backed keyword/surface measurements.`},
    {key:'competitors',label:'Competitor gap',weight:15,score:competitorOpportunity==null?null:round(competitorOpportunity,1),detail:competitorOpportunity==null?'Not measured':`${rankComparisons} comparable competitor ranking measurements${bestCompetitorHealth!=null?`; strongest measured competitor website health ${round(bestCompetitorHealth,1)}/100`:''}.`},
    {key:'gbp',label:'GBP engagement trend',weight:10,score:gbpOpportunity,detail:gbpOpportunity==null?'Not measured':`${gbp?.previousTotal||0} → ${gbp?.currentTotal||0} measured GBP actions across comparable 30-day windows.`},
  ]
  const measured=components.filter(c=>c.score!=null),measuredWeight=measured.reduce((s,c)=>s+c.weight,0),weighted=measured.reduce((s,c)=>s+Number(c.score)*c.weight,0)
  const opportunityScore=measuredWeight?round(weighted/measuredWeight,1):null,coverage=round(measuredWeight,1)
  const band=opportunityScore==null?'not_measured':opportunityScore<25?'low':opportunityScore<50?'moderate':opportunityScore<75?'high':'very_high'

  const comparisons:any[]=[]
  if(latestAudit&&previousAudit){comparisons.push({key:'website_health',label:'Website health',current:websiteHealth,previous:previousWebsiteHealth,delta:websiteHealth!=null&&previousWebsiteHealth!=null?round(websiteHealth-previousWebsiteHealth,1):null,unit:'points',current_period:dateOnly(latestAudit.checked_at),previous_period:dateOnly(previousAudit.checked_at)})}
  if(gscCurrent&&gscPrevious){for(const [key,label,unit] of [['clicks','Organic clicks','count'],['impressions','Organic impressions','count'],['ctr','Organic CTR','ratio'],['position','Average organic position','position']] as const){const c=num(gscCurrent[key]),p=num(gscPrevious[key]);comparisons.push({key:`gsc_${key}`,label,current:c,previous:p,delta:c!=null&&p!=null?round(c-p,key==='ctr'?4:1):null,delta_pct:deltaPct(c,p)==null?null:round(deltaPct(c,p)!,1),unit,current_period:`${gscCurrent.period_start} → ${gscCurrent.period_end}`,previous_period:`${gscPrevious.period_start} → ${gscPrevious.period_end}`})}}
  if(ranks.previous.length){comparisons.push({key:'ranking_average_position',label:'Tracked ranking average position',current:ranks.currentSummary.average_position,previous:ranks.previousSummary.average_position,delta:ranks.currentSummary.average_position!=null&&ranks.previousSummary.average_position!=null?round(ranks.currentSummary.average_position-ranks.previousSummary.average_position,1):null,unit:'position',current_period:'Latest measurement per tracked keyword/surface',previous_period:'Previous measurement per tracked keyword/surface'});comparisons.push({key:'ranking_top10',label:'Tracked keywords in Top 10',current:ranks.currentSummary.top10,previous:ranks.previousSummary.top10,delta:ranks.currentSummary.top10-ranks.previousSummary.top10,unit:'count',current_period:'Latest measurements',previous_period:'Previous measurements'})}
  if(gbp&&gbp.previousTotal>0){comparisons.push({key:'gbp_actions',label:'GBP measured actions',current:round(gbp.currentTotal,0),previous:round(gbp.previousTotal,0),delta:round(gbp.currentTotal-gbp.previousTotal,0),delta_pct:gbp.change_pct==null?null:round(gbp.change_pct,1),unit:'count',current_period:`${gbp.currentStart} → ${gbp.currentEnd}`,previous_period:`${gbp.previousStart} → ${gbp.previousEnd}`})}

  const recommendations:RecommendationDraft[]=[]
  if(latestAudit){const r=ref('business_visibility_audits',latestAudit,'Latest website audit')
    if(latestAudit.indexable===false)addRecommendation(recommendations,{recommendation_key:'website:indexability',category:'technical_seo',priority:'critical',title:'Restore website indexability',finding:'The latest source-backed website audit measured the site as non-indexable.',recommended_action:'Identify and remove the blocking noindex/robots condition, then rerun the website audit to verify recovery.',source_refs:[r!]})
    if(num(latestAudit.technical_score)!=null&&Number(latestAudit.technical_score)<70)addRecommendation(recommendations,{recommendation_key:'website:technical',category:'technical_seo',priority:Number(latestAudit.technical_score)<50?'high':'medium',title:'Improve technical SEO health',finding:`The latest technical SEO score is ${latestAudit.technical_score}/100.`,recommended_action:'Work through the documented technical audit issues in priority order and rerun the source-backed audit after fixes.',source_refs:[r!]})
    if(num(latestAudit.on_page_seo_score)!=null&&Number(latestAudit.on_page_seo_score)<70)addRecommendation(recommendations,{recommendation_key:'website:on_page',category:'on_page_seo',priority:Number(latestAudit.on_page_seo_score)<50?'high':'medium',title:'Strengthen on-page SEO',finding:`The latest on-page SEO score is ${latestAudit.on_page_seo_score}/100.`,recommended_action:'Correct measured title, meta, heading, content and internal-link issues shown in the audit; verify with a new audit.',source_refs:[r!]})
    if(num(latestAudit.performance_score)!=null&&Number(latestAudit.performance_score)<60)addRecommendation(recommendations,{recommendation_key:'website:performance',category:'technical_seo',priority:'medium',title:'Improve website performance',finding:`The latest measured performance score is ${latestAudit.performance_score}/100.`,recommended_action:'Prioritize the measured performance bottlenecks and verify improvements with a fresh performance audit.',source_refs:[r!]})
  }
  for(const r of [...queryOpportunityRows].sort((a,b)=>Number(b.impressions||0)-Number(a.impressions||0)).slice(0,5)){const q=String(r.dimension_value||'').trim();if(!q)continue;const sr=ref('business_visibility_gsc_metrics',r,`Search Console query: ${q}`);const pos=Number(r.position||0),ctr=Number(r.ctr||0);if(pos>=4&&pos<=20)addRecommendation(recommendations,{recommendation_key:`gsc:position:${hash(q).slice(0,16)}`,category:'content',priority:Number(r.impressions||0)>=100?'high':'medium',title:`Improve visibility for “${q}”`,finding:`Search Console recorded ${Number(r.impressions||0).toLocaleString()} impressions, ${Number(r.clicks||0).toLocaleString()} clicks and average position ${pos.toFixed(1)} for this query in the latest stored period.`,recommended_action:'Review the ranking page and strengthen content relevance, internal links, title/meta alignment and supporting topical coverage for this measured query.',source_refs:[sr!]});else if(pos>0&&pos<=10&&ctr<0.03)addRecommendation(recommendations,{recommendation_key:`gsc:ctr:${hash(q).slice(0,16)}`,category:'ctr',priority:'medium',title:`Improve search CTR for “${q}”`,finding:`Search Console recorded ${Number(r.impressions||0).toLocaleString()} impressions at average position ${pos.toFixed(1)} with ${(ctr*100).toFixed(1)}% CTR.`,recommended_action:'Review the measured ranking page title and meta description for relevance and clarity, then compare CTR after enough new Search Console data accumulates.',source_refs:[sr!]})}
  for(const r of [...ranks.current].filter(x=>rankingWeakness(x)!=null&&Number(rankingWeakness(x))>0).sort((a,b)=>Number(rankingWeakness(b))-Number(rankingWeakness(a))).slice(0,5)){const local=['local_pack','maps','local_finder'].includes(String(r.surface));const sr=ref('business_visibility_rankings',r,`${r.keyword} · ${r.surface}`);addRecommendation(recommendations,{recommendation_key:`rank:${hash(rankingKey(r)).slice(0,20)}`,category:local?'local_rank':'organic_rank',priority:r.not_found||Number(r.position)>10?'high':'medium',title:`Improve ${local?'local':'organic'} visibility for “${r.keyword}”`,finding:`The latest source-backed ${r.surface} measurement in ${r.search_location} is ${r.not_found?'Not found':`#${r.position}`}.`,recommended_action:local?'Review GBP relevance/completeness, local landing-page alignment, citations/reputation and measured competitor gaps; remeasure the same keyword/location/surface after changes.':'Review the ranking page, content relevance, internal links and measured competitor gaps; remeasure the same keyword/location/surface after changes.',source_refs:[sr!]})}
  if(competitorOpportunity!=null&&competitorOpportunity>=15){const refs=uniqueRefs([ref('business_visibility_audits',latestAudit,'Business website audit'),...[...latestCompetitorAuditById.values()].slice(0,3).map(r=>ref('business_visibility_competitor_audits',r,'Competitor website audit'))]);addRecommendation(recommendations,{recommendation_key:'competitor:measured_gap',category:'competitor_gap',priority:competitorOpportunity>=40?'high':'medium',title:'Close measured competitor visibility gaps',finding:`Current source-backed comparisons show a ${round(competitorOpportunity,1)}/100 competitor-gap opportunity signal${rankComparisons?` across ${rankComparisons} comparable ranking measurements`:''}.`,recommended_action:'Review the specific measured website/ranking gaps against tracked competitors and prioritize the highest-impact differences; do not infer unmeasured competitor facts.',source_refs:refs})}
  if(gbp&&gbp.previousTotal>0&&gbp.change_pct!=null&&gbp.change_pct<=-10){const currentRows=input.gbpMetrics.filter(r=>String(r.metric_date)>=gbp.currentStart&&String(r.metric_date)<=gbp.currentEnd);const refs=uniqueRefs(currentRows.slice(0,8).map(r=>ref('business_visibility_gbp_metrics',r,String(r.metric||'GBP metric'))));addRecommendation(recommendations,{recommendation_key:`gbp:engagement_decline:${gbp.currentEnd}`,category:'google_business_profile',priority:gbp.change_pct<=-30?'high':'medium',title:'Investigate GBP engagement decline',finding:`Measured GBP actions changed ${round(gbp.change_pct,1)}% versus the preceding comparable 30-day window (${round(gbp.previousTotal,0)} → ${round(gbp.currentTotal,0)}).`,recommended_action:'Review which measured GBP actions declined, recent profile/content/reputation changes and seasonal context before deciding on corrective work.',source_refs:refs})}
  for(const a of input.alerts.filter(r=>r.status==='open'&&['critical','warning'].includes(String(r.severity))).slice(0,5)){const sr=ref('business_visibility_alerts',a,String(a.title||'Visibility alert'));addRecommendation(recommendations,{recommendation_key:`alert:${a.alert_key||a.id}`,category:'visibility_alert',priority:a.severity==='critical'?'critical':'high',title:String(a.title||'Visibility alert'),finding:String(a.detail||'A source-backed visibility alert is open.'),recommended_action:'Review the underlying source record, correct the measured issue where appropriate, then mark the alert resolved only after verification.',source_refs:[sr!]})}

  const sourceManifest=uniqueRefs([
    ref('business_visibility_audits',latestAudit,'Latest website audit'),ref('business_visibility_audits',previousAudit,'Previous website audit'),
    ...ranks.current.slice(0,50).map(r=>ref('business_visibility_rankings',r,`${r.keyword} · ${r.surface}`)),
    ...queryRows.slice(0,50).map(r=>ref('business_visibility_gsc_metrics',r,`GSC query: ${r.dimension_value}`)),
    ...input.gbpMetrics.slice(0,80).map(r=>ref('business_visibility_gbp_metrics',r,String(r.metric||'GBP metric'))),
    ...[...latestCompetitorAuditById.values()].slice(0,10).map(r=>ref('business_visibility_competitor_audits',r,'Competitor audit')),
    ...[...latestCompetitorRanks.values()].slice(0,50).map(r=>ref('business_visibility_competitor_rankings',r,`${r.keyword} · competitor rank`)),
    ...input.alerts.filter(r=>r.status==='open').slice(0,20).map(r=>ref('business_visibility_alerts',r,String(r.title||'Visibility alert'))),
  ])

  const periodEnds=[dateOnly(latestAudit?.checked_at),dateOnly(gscCurrent?.period_end),gbp?.currentEnd,...ranks.current.map(r=>dateOnly(r.checked_at))].filter((x):x is string=>Boolean(x)).sort()
  const periodStarts=[dateOnly(previousAudit?.checked_at),dateOnly(gscCurrent?.period_start),gbp?.currentStart,...ranks.previous.map(r=>dateOnly(r.checked_at))].filter((x):x is string=>Boolean(x)).sort()
  const period_start=periodStarts[0]||periodEnds[0]||null,period_end=periodEnds[periodEnds.length-1]||period_start

  const topFindings=recommendations.slice().sort((a,b)=>({critical:4,high:3,medium:2,low:1}[b.priority]-{critical:4,high:3,medium:2,low:1}[a.priority])).slice(0,2).map(r=>r.title)
  const executiveSummary=opportunityScore==null
    ?`${business.name} does not yet have enough source-backed visibility measurements to calculate an opportunity score. Missing data is not treated as zero.`
    :`${business.name} has a ${prettyBand(band).toLowerCase()} evidence-backed visibility opportunity score of ${opportunityScore}/100 with ${coverage}% measurement coverage. ${topFindings.length?`Highest-priority measured opportunities: ${topFindings.join('; ')}.`:'No high-priority recommendation was generated from the currently measured sources.'} Missing areas are not treated as zero.`

  const fingerprintPayload={
    audit:audits.slice(0,2).map(r=>[r.id,r.checked_at,r.technical_score,r.on_page_seo_score,r.performance_score,r.indexable,r.http_status]),
    rankings:[...ranks.current,...ranks.previous].map(r=>[r.id,r.checked_at,r.position,r.not_found]),
    gsc:[gscCurrent,gscPrevious,...queryRows].filter(Boolean).map((r:any)=>[r.id,r.period_start,r.period_end,r.dimension_type,r.dimension_value,r.clicks,r.impressions,r.ctr,r.position]),
    gbp:input.gbpMetrics.map(r=>[r.id,r.metric_date,r.metric,r.metric_value]),
    competitorAudits:[...latestCompetitorAuditById.values()].map(r=>[r.id,r.checked_at,r.technical_score,r.on_page_seo_score,r.performance_score]),
    competitorRanks:[...latestCompetitorRanks.values()].map(r=>[r.id,r.checked_at,r.position,r.not_found]),
    alerts:input.alerts.filter(r=>r.status==='open').map(r=>[r.id,r.last_seen_at,r.status,r.severity]),
  }
  const source_fingerprint=hash(fingerprintPayload)
  return {
    version:'4.3',generated_at:new Date().toISOString(),business:{id:String(business.id),name:String(business.name),website:business.website||null},
    period_start,period_end,opportunity_score:opportunityScore,opportunity_band:band,measurement_coverage:coverage,
    components,comparisons,source_manifest:sourceManifest,recommendations,executive_summary:executiveSummary,
    current:{website:{health:websiteHealth,technical_score:num(latestAudit?.technical_score),on_page_seo_score:num(latestAudit?.on_page_seo_score),performance_score:num(latestAudit?.performance_score),indexable:latestAudit?.indexable??null,checked_at:latestAudit?.checked_at||null},search_console:gscCurrent?{period_start:gscCurrent.period_start,period_end:gscCurrent.period_end,clicks:num(gscCurrent.clicks),impressions:num(gscCurrent.impressions),ctr:num(gscCurrent.ctr),position:num(gscCurrent.position),opportunity_query_count:queryOpportunityRows.length}:null,rankings:ranks.currentSummary,gbp:gbp?{current_start:gbp.currentStart,current_end:gbp.currentEnd,current_total:round(gbp.currentTotal,0),previous_total:round(gbp.previousTotal,0),change_pct:gbp.change_pct==null?null:round(gbp.change_pct,1),metrics:gbp.current}:null,competitors:{best_website_health:bestCompetitorHealth==null?null:round(bestCompetitorHealth,1),rank_comparisons:rankComparisons,competitor_outranks:competitorOutranks}},
    source_fingerprint,
  }
}

export function buildReportExecutiveSummary(reportType:'prospect'|'client',snapshot:Row,recommendations:Row[]){
  if(reportType==='prospect')return `${snapshot.executive_summary||'Source-backed visibility measurements were reviewed.'} This prospect report describes measured opportunities only; it does not guarantee rankings, traffic, leads or revenue.`
  const positive=(snapshot.comparisons||[]).filter((c:any)=>{if(c.current==null||c.previous==null)return false;if(c.unit==='position')return Number(c.current)<Number(c.previous);return Number(c.current)>Number(c.previous)}).slice(0,2)
  return `${snapshot.executive_summary||'Source-backed visibility measurements were reviewed.'}${positive.length?` Measured improvements include ${positive.map((c:any)=>c.label).join(' and ')}.`:''} This client report separates measured results from recommendations and does not treat missing data as zero.`
}
