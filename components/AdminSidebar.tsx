const groups:[string,[string,string][]][]=[
  ['Directory',[
    ['dashboard','Dashboard'],['businesses','Businesses'],['submissions','Approval Queue'],['claims','Claims'],['leads','Skylight Lead Marketplace'],['reports','Listing Reports']
  ]],
  ['Markets & Content',[
    ['locations','Markets & Locations'],['categories','Category Manager'],['branches','Locations & Branches'],['coverage','Page Coverage Manager'],['content-blocks','Site Content Blocks'],['media','Business Media'],['guides','Content Hub / Guides'],['seo','SEO Command Center']
  ]],
  ['Site Management',[
    ['site-builder','Site Builder / Brand & Content'],['pricing','Pricing & Plans'],['revenue-stack','Revenue Stack'],['revenue','Revenue Operations'],['navigation','Navigation Editor'],['edit-requests','Business Edit Requests'],['subscriptions','Subscription Manager'],['sponsorships','Sponsored Placement']
  ]],
  ['Growth & Intelligence',[
    ['growth','Acquisition Funnel'],['inventory-expansion','Inventory Expansion'],['routing','Lead Routing'],['prospects','Skylight Sales CRM'],['outreach','Marketing Opportunities'],['marketing-leads','Skylight Leads'],['marketing','Marketing Control Center'],['search','Search Intelligence'],['analytics','Listing Analytics']
  ]],
  ['Administration',[
    ['launch-readiness','Launch Readiness'],['bulk-import','Bulk Import'],['team','Team / Roles'],['audit','Audit Log']
  ]]
]

export function AdminSidebar(){
  return <aside className="admin-side">
    <strong>CENTRAL IL LOCAL PROS</strong>
    <p className="small">Private Staff Console<br/>Powered by Skylight Reflections Marketing</p>
    {groups.map(([g,items])=><div key={g}><h3>{g}</h3>{items.map(([s,l])=><a key={s} href={s==='dashboard'?'/admin':`/admin/${s}`}>{l}</a>)}</div>)}
    <h3>Public</h3><a href="/">← Public Site</a>
    <form action="/auth/signout" method="post"><button className="btn btn-light full" style={{marginTop:12}}>Log Out</button></form>
  </aside>
}
