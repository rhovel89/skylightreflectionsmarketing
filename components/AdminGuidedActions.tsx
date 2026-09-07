'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Step={label:string;detail:string;href:string}
type Guide={title:string;summary:string;steps:Step[]}

function businessId(pathname:string){const match=pathname.match(/^\/admin\/businesses\/([^/]+)/);return match?.[1]||''}

function guideFor(pathname:string):Guide|null{
  const id=businessId(pathname)
  if(pathname==='/admin/businesses')return{
    title:'Add or manage a business',
    summary:'Start with the listing, then confirm location/category details and provenance before deeper trust or growth work.',
    steps:[
      {label:'Add Business',detail:'Create the canonical listing.',href:'/admin/businesses#add-business'},
      {label:'Find & Edit',detail:'Search or update existing listings.',href:'/admin/businesses#business-results'},
      {label:'Verify',detail:'Review source-backed trust controls.',href:'/admin/verification'},
      {label:'Media',detail:'Add logo, photos, menus or covers.',href:'/admin/business-media'},
    ],
  }
  if(pathname==='/admin/skylight-sales')return{
    title:'Work a prospect from research to reply',
    summary:'Research first, verify the decision-maker, then use the human-reviewed outreach and reply flow.',
    steps:[
      {label:'Research',detail:'Find source-backed decision-maker data.',href:'/admin/acquisition-research'},
      {label:'Prioritize',detail:'Review the actual opportunity queue.',href:'/admin/skylight-sales#sales-opportunities'},
      {label:'Outreach',detail:'Review and approve a send.',href:'/admin/skylight-sales/outreach'},
      {label:'Replies',detail:'Work responses and next actions.',href:'/admin/skylight-sales/inbox'},
    ],
  }
  if(pathname==='/admin/skylight-operations')return{
    title:'Create and deliver client work',
    summary:'Create the proposal, review it, convert accepted work into delivery, then manage invoicing separately.',
    steps:[
      {label:'New Proposal',detail:'Choose client, services and pricing.',href:'/admin/skylight-operations?tab=new#proposal-builder'},
      {label:'Review Proposals',detail:'Track draft, sent and accepted work.',href:'/admin/skylight-operations?tab=proposals'},
      {label:'Projects',detail:'Manage active delivery work.',href:'/admin/skylight-operations?tab=projects'},
      {label:'Invoices',detail:'Handle client billing explicitly.',href:'/admin/skylight-invoices'},
    ],
  }
  if(pathname==='/admin/revenue')return{
    title:'Review money and billing health',
    summary:'Start with attention items, then drill into the exact revenue stream instead of changing pricing from the overview.',
    steps:[
      {label:'Attention',detail:'Past due, ending soon or review-needed.',href:'/admin/revenue#revenue-attention'},
      {label:'Subscriptions',detail:'Review recurring plan state.',href:'/admin/subscriptions'},
      {label:'Sponsored',detail:'Manage paid placement inventory.',href:'/admin/sponsorships'},
      {label:'Pricing',detail:'Edit plans only when intentional.',href:'/admin/pricing'},
    ],
  }
  if(pathname==='/admin/seo')return{
    title:'Improve legitimate search coverage',
    summary:'Work the closest eligible markets first, then editorial quality and deeper inventory gaps.',
    steps:[
      {label:'Quick Wins',detail:'Review markets closest to eligibility.',href:'/admin/seo#seo-action-queue'},
      {label:'Data Quality',detail:'Fix persistent source/coverage issues.',href:'/admin/data-quality?type=seo_inventory&priority=high'},
      {label:'Inventory',detail:'Research legitimate provider depth.',href:'/admin/inventory-expansion'},
      {label:'Search Intel',detail:'Review broader search opportunities.',href:'/admin/search'},
    ],
  }
  if(id&&pathname===`/admin/businesses/${id}/visibility`)return{
    title:'Audit and understand this business',
    summary:'Measure the live site first, then add source-backed ranking data before creating opportunity reports.',
    steps:[
      {label:'Run Audit',detail:'Measure the actual public website.',href:`/admin/businesses/${id}/visibility#website-audit`},
      {label:'Track Rankings',detail:'Add keyword/location targets.',href:`/admin/businesses/${id}/visibility#ranking-tracker`},
      {label:'Monitor',detail:'Review alerts and competitors.',href:`/admin/businesses/${id}/visibility/monitoring`},
      {label:'Report',detail:'Turn evidence into an opportunity report.',href:`/admin/businesses/${id}/visibility/reporting`},
    ],
  }
  if(id&&pathname.startsWith(`/admin/businesses/${id}/visibility/`))return{
    title:'Continue the visibility workflow',
    summary:'Keep measurements, recommendations, execution and results linked to the same business record.',
    steps:[
      {label:'Visibility',detail:'Current SEO and ranking evidence.',href:`/admin/businesses/${id}/visibility`},
      {label:'Reports',detail:'Review measured opportunities.',href:`/admin/businesses/${id}/visibility/reporting`},
      {label:'Execution',detail:'Track accepted work separately.',href:`/admin/businesses/${id}/visibility/execution`},
      {label:'Results',detail:'Review measured client outcomes.',href:`/admin/businesses/${id}/visibility/client-health`},
    ],
  }
  return null
}

export function AdminGuidedActions(){
  const pathname=usePathname()
  const guide=guideFor(pathname)
  if(!guide)return null
  return <div className="admin-guided-shell"><section className="admin-guided-actions" aria-label="Guided owner task">
    <div className="admin-guided-intro"><span>Guided Task</span><div><strong>{guide.title}</strong><p>{guide.summary}</p></div></div>
    <ol>{guide.steps.map((step,index)=><li key={`${step.href}-${step.label}`}><Link href={step.href}><b>{index+1}</b><span><strong>{step.label}</strong><small>{step.detail}</small></span><i aria-hidden="true">→</i></Link></li>)}</ol>
  </section></div>
}
