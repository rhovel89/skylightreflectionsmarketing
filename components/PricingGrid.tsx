import type { Plan } from '@/lib/types'
import { GrowthTrackedLink } from '@/components/GrowthTracking'

const dollars=(c:number|null|undefined)=>`$${Math.round((c??0)/100)}`
const bestFor:Record<string,string>={free:'Businesses that want a basic public presence',verified:'Businesses that want the verification workflow and enhanced controls',featured:'Businesses that want stronger visual presence and labeled visibility options',pro:'Businesses that want the full conversion, Lead Inbox and reporting toolkit'}

export function PricingGrid({plans}:{plans:Plan[]}){
  return <div className="pricing-grid conversion-pricing-grid">{plans.filter(p=>p.is_active).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(p=>{
    const free=p.slug==='free'||(p.monthly_price_cents??0)===0
    const plan=(['verified','featured','pro'].includes(p.slug)?p.slug:'free') as 'free'|'verified'|'featured'|'pro'
    const row=p as Plan&{stripe_monthly_payment_url?:string|null;stripe_annual_payment_url?:string|null}
    const fallback=`/contact?reason=visibility-plan&plan=${encodeURIComponent(plan)}&source=pricing-grid#marketing-review`
    const monthlyHref=free?'#list':row.stripe_monthly_payment_url||fallback
    const annualHref=row.stripe_annual_payment_url||fallback
    const monthly=Number(p.monthly_price_cents||0)
    const annual=Number(p.annual_price_cents||0)
    const annualSavings=annual>0&&monthly>0?Math.max(0,monthly*12-annual):0
    const annualMonthly=annual>0?Math.round(annual/12):0
    return <div className={`price-card conversion-price-card ${p.slug==='featured'?'popular':''}`} key={p.id}>
      <div className="price-card-topline"><div>{p.badge&&<span className="badge verified">{p.badge}</span>}</div><span className="price-card-plan-type">{free?'Free forever':'Optional paid plan'}</span></div>
      <h3>{p.name}</h3>
      <p className="price-best-for"><span>Best for</span>{bestFor[p.slug]||'Businesses that want additional directory tools'}</p>
      <div className="price">{dollars(p.monthly_price_cents)}<small>/mo</small></div>
      {annual>0?<div className="annual-value"><strong>{dollars(annual)}/year</strong><span>≈ {dollars(annualMonthly)}/mo{annualSavings>0?` · save ${dollars(annualSavings)}/yr`:''}</span></div>:<div className="annual-value"><strong>No subscription required</strong><span>Keep a basic eligible listing without a paid plan.</span></div>}
      <p className="price-description">{p.description}</p>
      <div className="price-feature-head">What you get</div>
      <ul>{Array.isArray(p.features)?(p.features as string[]).map((f,i)=><li key={i}><span aria-hidden="true">✓</span>{f}</li>):null}</ul>
      {p.slug==='verified'&&<div className="price-clarifier"><strong>Important:</strong> this plan provides access to the verification workflow. The Verified badge appears only after approval.</div>}
      {p.slug==='featured'&&<div className="price-clarifier"><strong>Visibility stays labeled:</strong> Featured/Sponsored placement is separate from organic directory order.</div>}
      {p.slug==='pro'&&<div className="price-clarifier"><strong>Lead Inbox access:</strong> lead pricing and delivered-lead billing remain separate from the Pro subscription.</div>}
      {free
        ? <GrowthTrackedLink eventType="list_business_cta_click" plan="free" source="pricing-grid" className="btn btn-primary full" href="#list">Start Free — Claim or List</GrowthTrackedLink>
        : <div className="price-actions"><GrowthTrackedLink eventType="visibility_plan_click" plan={plan} source="pricing-grid-monthly" className="btn btn-primary full" href={monthlyHref}>Choose Monthly · {dollars(p.monthly_price_cents)}/mo</GrowthTrackedLink>{annual>0?<GrowthTrackedLink eventType="visibility_plan_click" plan={plan} source="pricing-grid-annual" className="btn btn-light full" href={annualHref}>Choose Annual · {dollars(annual)}/yr</GrowthTrackedLink>:null}</div>}
      {!free&&<p className="price-trust-note">Payment buys the listed business tools and/or clearly labeled visibility. It does not buy organic rank, automatic verification, guaranteed leads or editorial preference.</p>}
    </div>
  })}</div>
}
