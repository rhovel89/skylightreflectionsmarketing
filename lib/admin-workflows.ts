export type AdminWorkspaceItem = { href: string; label: string; hint?: string }
export type AdminWorkspace = { id: string; label: string; description: string; items: AdminWorkspaceItem[] }
export type AdminWorkflowGuide = { eyebrow: string; title: string; body: string; actions: AdminWorkspaceItem[] }

const STATIC_WORKSPACES: AdminWorkspace[] = [
  { id:'priorities', label:'Priorities', description:'Handle the few items that need attention before opening deeper tools.', items:[
    { href:'/admin/action-center', label:'My Priorities' },{ href:'/admin/notifications', label:'Notifications' },{ href:'/admin/operations-command-center', label:'Growth Operations' },
  ]},
  { id:'businesses', label:'Businesses', description:'Manage listings, approvals, ownership, verification and public profile quality.', items:[
    { href:'/admin/businesses', label:'All Businesses' },{ href:'/admin/submissions', label:'Approvals' },{ href:'/admin/claims', label:'Claims' },{ href:'/admin/verification', label:'Verification' },{ href:'/admin/edit-requests', label:'Edit Requests' },{ href:'/admin/business-media', label:'Media & Menus' },{ href:'/admin/reports', label:'Listing Reports' },
  ]},
  { id:'sales', label:'Sales', description:'Research real prospects, work the daily queue, review outreach and track measured conversion.', items:[
    { href:'/admin/skylight-sales', label:'Overview' },{ href:'/admin/skylight-sales/daily', label:'Daily Command' },{ href:'/admin/skylight-sales/inbox', label:'Inbox' },{ href:'/admin/skylight-sales/outreach', label:'Outreach' },{ href:'/admin/skylight-sales/acquisition', label:'Acquisition' },{ href:'/admin/skylight-sales/conversions', label:'Conversions' },{ href:'/admin/acquisition-research', label:'Research' },{ href:'/admin/prospects', label:'CRM' },
  ]},
  { id:'client-work', label:'Client Work', description:'Move real clients from proposal and intake through delivery, invoicing and measured results.', items:[
    { href:'/admin/skylight-operations', label:'Projects & Proposals' },{ href:'/admin/skylight-intake', label:'Intake & Assets' },{ href:'/admin/skylight-services', label:'Services' },{ href:'/admin/skylight-invoices', label:'Invoices' },{ href:'/admin/skylight-operations/visibility-retention', label:'Results & Retention' },
  ]},
  { id:'money', label:'Money', description:'Review revenue first, then manage pricing, billing and monetization products independently.', items:[
    { href:'/admin/revenue-stack', label:'Revenue Overview' },{ href:'/admin/revenue', label:'Revenue Operations' },{ href:'/admin/revenue-intelligence', label:'Revenue Intelligence' },{ href:'/admin/pricing', label:'Pricing & Plans' },{ href:'/admin/lead-buyers', label:'Lead Buyers' },{ href:'/admin/lead-billing', label:'Lead Billing' },{ href:'/admin/subscriptions', label:'Subscriptions' },{ href:'/admin/sponsorships', label:'Sponsored' },{ href:'/admin/skylight-eddm', label:'EDDM' },
  ]},
  { id:'growth-seo', label:'Growth & SEO', description:'Find evidence-backed search opportunities, fix coverage gaps and grow useful local inventory.', items:[
    { href:'/admin/seo', label:'SEO Command' },{ href:'/admin/data-quality?state=active&type=seo_inventory&priority=high', label:'SEO Quick Wins' },{ href:'/admin/data-quality', label:'Data Quality' },{ href:'/admin/content-intelligence', label:'Content Intelligence' },{ href:'/admin/inventory-expansion', label:'Inventory Growth' },{ href:'/admin/search', label:'Search Intelligence' },{ href:'/admin/guides', label:'Guides' },{ href:'/admin/locations', label:'Markets' },{ href:'/admin/categories', label:'Categories' },
  ]},
  { id:'website', label:'Website', description:'Edit the public experience, navigation and expansion settings without touching private operations.', items:[
    { href:'/admin/site-builder', label:'Site Builder' },{ href:'/admin/navigation', label:'Navigation' },{ href:'/admin/network-expansion', label:'Replication' },{ href:'/admin/launch-readiness', label:'Launch Readiness' },
  ]},
]

export function adminWorkflowPathOnly(href:string){return href.split('?')[0]}

function businessWorkspace(pathname:string):AdminWorkspace|null{
  const match=pathname.match(/^\/admin\/businesses\/([^/]+)/)
  if(!match)return null
  const id=match[1],base=`/admin/businesses/${id}`
  return {id:'business-detail',label:'Business Workspace',description:'Keep listing facts trustworthy, then measure visibility, report opportunities and track outcomes.',items:[
    {href:base,label:'Business Profile'},{href:`${base}/visibility`,label:'Visibility'},{href:`${base}/visibility/monitoring`,label:'Monitoring'},{href:`${base}/visibility/google`,label:'Google Data'},{href:`${base}/visibility/reporting`,label:'Reports'},{href:`${base}/visibility/execution`,label:'Execution'},{href:`${base}/visibility/client-health`,label:'Client Health'},
  ]}
}

export function getAdminWorkspace(pathname:string):AdminWorkspace|null{
  const business=businessWorkspace(pathname);if(business)return business
  if(pathname==='/admin')return null
  const byId=(id:string)=>STATIC_WORKSPACES.find(w=>w.id===id)!
  if(pathname.startsWith('/admin/skylight-sales')||['/admin/acquisition-research','/admin/prospects','/admin/outreach','/admin/outreach-templates','/admin/marketing','/admin/email-drips'].some(p=>pathname===p||pathname.startsWith(`${p}/`)))return byId('sales')
  if(['/admin/skylight-operations','/admin/skylight-intake','/admin/skylight-services','/admin/skylight-invoices'].some(p=>pathname===p||pathname.startsWith(`${p}/`)))return byId('client-work')
  if(['/admin/revenue-stack','/admin/revenue','/admin/revenue-intelligence','/admin/pricing','/admin/lead-buyers','/admin/lead-billing','/admin/subscriptions','/admin/sponsorships','/admin/skylight-eddm','/admin/leads','/admin/local-commerce'].some(p=>pathname===p||pathname.startsWith(`${p}/`)))return byId('money')
  if(['/admin/seo','/admin/data-quality','/admin/content-intelligence','/admin/inventory-expansion','/admin/search','/admin/guides','/admin/locations','/admin/categories','/admin/branches','/admin/coverage','/admin/content-blocks','/admin/analytics'].some(p=>pathname===p||pathname.startsWith(`${p}/`)))return byId('growth-seo')
  if(['/admin/site-builder','/admin/navigation','/admin/network-expansion','/admin/launch-readiness'].some(p=>pathname===p||pathname.startsWith(`${p}/`)))return byId('website')
  if(['/admin/action-center','/admin/notifications','/admin/operations-command-center','/admin/growth-opportunities','/admin/launch-growth'].some(p=>pathname===p||pathname.startsWith(`${p}/`)))return byId('priorities')
  if(['/admin/businesses','/admin/submissions','/admin/claims','/admin/verification','/admin/edit-requests','/admin/business-media','/admin/media','/admin/reports'].some(p=>pathname===p||pathname.startsWith(`${p}/`)))return byId('businesses')
  return null
}

export function getAdminWorkspaceActiveHref(pathname:string,workspace:AdminWorkspace|null){
  if(!workspace)return ''
  const ranked=workspace.items.filter(item=>!item.href.includes('?')).map(item=>({item,path:adminWorkflowPathOnly(item.href)})).filter(({path})=>pathname===path||pathname.startsWith(`${path}/`)).sort((a,b)=>b.path.length-a.path.length)
  return ranked[0]?.item.href??''
}

function item(workspace:AdminWorkspace,label:string){return workspace.items.find(x=>x.label===label)!}

export function getAdminWorkflowGuide(pathname:string,workspace=getAdminWorkspace(pathname)):AdminWorkflowGuide|null{
  if(!workspace)return null
  if(workspace.id==='business-detail'){
    if(pathname.includes('/visibility/client-health'))return {eyebrow:'Owner Guide',title:'Review client health only from recorded facts',body:'Use measured outcomes, delivery status, reporting cadence and recorded billing signals. Missing data stays neutral.',actions:[item(workspace,'Client Health'),item(workspace,'Execution'),item(workspace,'Reports')]}
    if(pathname.includes('/visibility/execution'))return {eyebrow:'Owner Guide',title:'Finish the work, then measure the result separately',body:'Implementation completion is not an SEO result. Remeasure after the work before recording an outcome.',actions:[item(workspace,'Execution'),item(workspace,'Reports'),item(workspace,'Visibility')]}
    if(pathname.includes('/visibility/reporting'))return {eyebrow:'Owner Guide',title:'Turn measured gaps into a clear prospect or client report',body:'Refresh intelligence, review recommendations, then create a snapshot-stable report. Sales evidence still requires approval.',actions:[item(workspace,'Reports'),item(workspace,'Visibility'),item(workspace,'Execution')]}
    if(pathname.includes('/visibility/google'))return {eyebrow:'Owner Guide',title:'Use first-party Google data when you have authorization',body:'Import or sync Search Console and Business Profile data, then compare it with ranking and website evidence.',actions:[item(workspace,'Google Data'),item(workspace,'Visibility'),item(workspace,'Reports')]}
    if(pathname.includes('/visibility/monitoring'))return {eyebrow:'Owner Guide',title:'Watch movement without inventing rank data',body:'Track source-backed rankings, website changes, competitors and alerts. Unmeasured rankings remain Not measured.',actions:[item(workspace,'Monitoring'),item(workspace,'Visibility'),item(workspace,'Reports')]}
    if(pathname.includes('/visibility'))return {eyebrow:'Owner Guide',title:'Start with the website, then add real ranking evidence',body:'Run the website audit first. Add/import legitimate rankings next, then use Monitoring and Reports when enough evidence exists.',actions:[item(workspace,'Visibility'),item(workspace,'Monitoring'),item(workspace,'Reports')]}
    return {eyebrow:'Owner Guide',title:'Keep the business record trustworthy before growth work',body:'Confirm profile facts, coverage and trust first. Then open Visibility when you want SEO, Google and competitor intelligence.',actions:[item(workspace,'Business Profile'),item(workspace,'Visibility'),item(workspace,'Reports')]}
  }

  if(workspace.id==='sales')return {eyebrow:'Owner Guide',title:'Work the next real sales action, not every sales tool',body:'Use Daily Command for today, Research when contact evidence is missing, and Inbox/Conversions after real outreach receives activity.',actions:[item(workspace,'Daily Command'),item(workspace,'Research'),item(workspace,'Inbox')]}
  if(workspace.id==='businesses')return {eyebrow:'Owner Guide',title:'Find the business or clear the trust queue',body:'Search/open a business for full management. Use Approvals, Claims and Verification only when those queues need action.',actions:[item(workspace,'All Businesses'),item(workspace,'Approvals'),item(workspace,'Verification')]}
  if(workspace.id==='client-work')return {eyebrow:'Owner Guide',title:'Follow the client from agreement to delivery',body:'Start in Projects & Proposals, collect Intake & Assets, then manage Invoices and Results without creating duplicate client workflows.',actions:[item(workspace,'Projects & Proposals'),item(workspace,'Intake & Assets'),item(workspace,'Invoices')]}
  if(workspace.id==='money')return {eyebrow:'Owner Guide',title:'Review money first, edit pricing only when needed',body:'Use Revenue Overview for the big picture. Open operations for billing detail and Pricing only when you intentionally want to change an offer.',actions:[item(workspace,'Revenue Overview'),item(workspace,'Revenue Operations'),item(workspace,'Pricing & Plans')]}
  if(workspace.id==='growth-seo')return {eyebrow:'Owner Guide',title:'Start with evidence-backed SEO opportunities',body:'Use Quick Wins and SEO Command first. Move to Data Quality, Inventory Growth or Search Intelligence when the opportunity requires deeper work.',actions:[item(workspace,'SEO Quick Wins'),item(workspace,'SEO Command'),item(workspace,'Search Intelligence')]}
  if(workspace.id==='website')return {eyebrow:'Owner Guide',title:'Edit the public site without hunting through system tools',body:'Use Site Builder for brand/content, Navigation for menus, and Launch Readiness before major public changes.',actions:[item(workspace,'Site Builder'),item(workspace,'Navigation'),item(workspace,'Launch Readiness')]}
  if(workspace.id==='priorities')return {eyebrow:'Owner Guide',title:'Start with what actually needs attention',body:'Clear My Priorities first, check Notifications second, and open Growth Operations only when you need a broader queue.',actions:[item(workspace,'My Priorities'),item(workspace,'Notifications'),item(workspace,'Growth Operations')]}
  return null
}
