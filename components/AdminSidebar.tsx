import { DEFAULT_BRAND } from '@/lib/constants'

const groups:[string,[string,string][]][]=[
  ['Directory',[
    ['dashboard','Dashboard'],['businesses','Businesses'],['business-media','Business Media & Menus'],['submissions','Approval Queue'],['claims','Claims'],['leads','Skylight Lead Marketplace'],['lead-billing','Lead Revenue CRM'],['revenue-intelligence','Revenue Intelligence'],['lead-notifications','Lead Email & SMS Alerts'],['reports','Listing Reports']
  ]],
  ['Markets & Content',[
    ['locations','Markets & Locations'],['categories','Category Manager'],['branches','Locations & Branches'],['coverage','Page Coverage Manager'],['content-blocks','Site Content Blocks'],['media','Owner Media Review'],['guides','Content Hub / Guides'],['seo','SEO Command Center'],['data-quality','Data Quality & SEO Reverification'],['data-quality?state=active&type=seo_inventory&priority=high','SEO Eligibility Quick Wins']
  ]],
  ['Site Management',[
    ['site-builder','Site Builder / Brand & Content'],['pricing','Pricing & Plans'],['revenue-stack','Revenue Stack'],['revenue','Revenue Operations'],['navigation','Navigation Editor'],['edit-requests','Business Edit Requests'],['subscriptions','Subscription Manager'],['sponsorships','Featured / Sponsored Placement']
  ]],
  ['Growth & Intelligence',[
    ['operations-command-center','Growth Operations Command Center'],['acquisition-research','Acquisition Research Workbench'],['launch-growth','Launch + Growth Command Center'],['growth-opportunities','Growth Opportunity Queue'],['growth','Acquisition Funnel'],['content-intelligence','Content & Market Intelligence'],['inventory-expansion','Inventory Expansion'],['routing','Lead Routing'],['prospects','Skylight Sales CRM'],['outreach','Outreach Task Workbench'],['outreach-templates','Outreach Template Library'],['marketing-leads','Skylight Leads'],['marketing','Marketing Control Center'],['search','Search Intelligence'],['analytics','Listing Analytics']
  ]],
  ['Network',[
    ['network-expansion','Local Pros Replication Center']
  ]],
  ['Administration',[
    ['launch-readiness','Launch Readiness'],['bulk-import','Bulk Import'],['team','Team / Roles'],['audit','Audit Log']
  ]]
]

export function AdminSidebar(){
  return <aside className="admin-side">
    <strong>{DEFAULT_BRAND.directory_name.toUpperCase()}</strong>
    <p className="small">Private Staff Console<br/>Powered by {DEFAULT_BRAND.parent_brand_name}</p>
    {groups.map(([g,items])=><div key={g}><h3>{g}</h3>{items.map(([s,l])=><a key={s} href={s==='dashboard'?'/admin':`/admin/${s}`}>{l}</a>)}</div>)}
    <h3>Public</h3><a href="/">← Public Site</a>
    <form action="/auth/signout" method="post"><button className="btn btn-light full" style={{marginTop:12}}>Log Out</button></form>
  </aside>
}
