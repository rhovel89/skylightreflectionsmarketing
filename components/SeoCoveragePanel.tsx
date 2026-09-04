type SeoRow={id?:string;city?:string|null;category?:string|null;title?:string|null;intro?:string|null;content?:string|null;reviewed?:boolean|null;index_mode?:string|null;updated_at?:string|null}
type BranchRow={city?:string|null;business_id?:string|null}
type BusinessCategoryRow={business_id?:string|null;categories?:{name?:string|null;slug?:string|null;vertical?:string|null}|null}
type LocationRow={name:string;slug:string}
type CategoryRef={name:string;slug:string}
type MarketRow={marketKey:string;city:string;citySlug:string;category:string;categorySlug:string;providers:number;seo?:SeoRow;copyChars:number}

const key=(city:string,category:string)=>`${city.trim().toLowerCase()}::${category.trim().toLowerCase()}`

export function SeoCoveragePanel({rows,branches,businessCategories,locations}:{rows:SeoRow[];branches:BranchRow[];businessCategories:BusinessCategoryRow[];locations:LocationRow[]}){
  const categoriesByBusiness=new Map<string,Map<string,CategoryRef>>()
  const categoryRefs=new Map<string,CategoryRef>()
  for(const row of businessCategories){
    const businessId=String(row.business_id||'')
    const name=String(row.categories?.name||'').trim()
    const slug=String(row.categories?.slug||'').trim()
    if(!businessId||!name||!slug)continue
    const ref={name,slug}
    categoryRefs.set(name.toLowerCase(),ref)
    if(!categoriesByBusiness.has(businessId))categoriesByBusiness.set(businessId,new Map())
    categoriesByBusiness.get(businessId)!.set(name.toLowerCase(),ref)
  }

  const providerSets=new Map<string,Set<string>>()
  for(const branch of branches){
    const city=String(branch.city||'').trim()
    const businessId=String(branch.business_id||'')
    if(!city||!businessId)continue
    for(const category of categoriesByBusiness.get(businessId)?.values()||[]){
      const marketKey=key(city,category.name)
      if(!providerSets.has(marketKey))providerSets.set(marketKey,new Set())
      providerSets.get(marketKey)!.add(businessId)
    }
  }

  const seoByKey=new Map(rows.filter(r=>r.city&&r.category).map(r=>[key(String(r.city),String(r.category)),r]))
  const markets:MarketRow[]=[...providerSets.entries()].map(([marketKey,set])=>{
    const [cityKey,categoryKey]=marketKey.split('::')
    const location=locations.find(l=>l.name.toLowerCase()===cityKey)
    const seo=seoByKey.get(marketKey)
    const categoryRef=categoryRefs.get(categoryKey)
    const copyChars=String(seo?.intro||'').length+String(seo?.content||'').length
    return{
      marketKey,
      city:location?.name||cityKey.replace(/\b\w/g,m=>m.toUpperCase()),
      citySlug:location?.slug||'',
      category:seo?.category||categoryRef?.name||categoryKey,
      categorySlug:categoryRef?.slug||'',
      providers:set.size,
      seo,
      copyChars,
    }
  })

  const eligible=markets.filter(x=>x.providers>=3)
  const nearEligible=markets.filter(x=>x.providers===2).sort((a,b)=>a.city.localeCompare(b.city)||a.category.localeCompare(b.category))
  const deeperGaps=markets.filter(x=>x.providers===1)
  const reviewed=eligible.filter(x=>x.seo?.reviewed&&x.seo?.index_mode!=='noindex')
  const missing=eligible.filter(x=>!x.seo)
  const reviewQueue=eligible.filter(x=>x.seo&&x.copyChars<1000).sort((a,b)=>b.providers-a.providers||a.copyChars-b.copyChars||a.city.localeCompare(b.city)).slice(0,18)
  const protectedRows=rows.map(seo=>{const providers=providerSets.get(key(String(seo.city||''),String(seo.category||'')))?.size||0;return{seo,providers}}).filter(x=>x.seo.category&&x.providers<3)
  const stale=eligible.filter(x=>x.seo?.updated_at&&Date.now()-new Date(String(x.seo.updated_at)).getTime()>1000*60*60*24*180).length

  return <section className="admin-card">
    <div className="section-head"><div><div className="kpi">Private SEO intelligence</div><h2>Indexable Market Coverage</h2><p className="muted">Tracks only real city/category inventory. A page is considered index-eligible here only when at least three distinct published businesses serve that category in the market.</p></div></div>
    <div className="grid grid-4">
      <div className="card"><div className="kpi">Eligible markets</div><h2>{eligible.length}</h2><p className="small muted">3+ published providers</p></div>
      <div className="card"><div className="kpi">Reviewed coverage</div><h2>{reviewed.length}</h2><p className="small muted">Reviewed and not manually noindex</p></div>
      <div className="card"><div className="kpi">Missing SEO records</div><h2>{missing.length}</h2><p className="small muted">Eligible inventory without a matching SEO record</p></div>
      <div className="card"><div className="kpi">One provider away</div><h2>{nearEligible.length}</h2><p className="small muted">2-provider markets; research quality before quantity</p></div>
    </div>

    <div className="section-head" style={{marginTop:28}}><div><h3>SEO eligibility action queue</h3><p className="small muted">These markets are closest to the live indexing threshold. A third provider counts only when the business/category/location relationship is legitimate and source-backed. Service areas do not become offices, and a paid plan never changes eligibility.</p></div><a href="/admin/data-quality?type=seo_inventory&priority=high">Open persistent task queue →</a></div>
    {nearEligible.length?<div className="grid grid-3">{nearEligible.slice(0,12).map(x=><div className="card" key={x.marketKey}><div className="kpi">2 providers · 1 legitimate addition needed</div><h3>{x.category} in {x.city}, IL</h3><p className="small muted">Keep protected until provider #3 is verified as real inventory.</p><div className="card-actions"><a href="/admin/inventory-expansion">Research inventory →</a>{x.citySlug&&x.categorySlug&&<a href={`/illinois/${x.citySlug}/${x.categorySlug}`} target="_blank" rel="noreferrer">Preview public market →</a>}</div></div>)}</div>:<div className="notice">No markets are currently exactly one legitimate provider away from the three-provider threshold.</div>}
    {deeperGaps.length>0&&<p className="small muted" style={{marginTop:14}}>{deeperGaps.length} additional market{deeperGaps.length===1?' is':'s are'} at one provider and require deeper inventory development before SEO review.</p>}

    <div className="section-head" style={{marginTop:28}}><div><h3>Copy improvement queue</h3><p className="small muted">Prioritizes index-eligible pages with shorter combined intro + buying-guide copy. Provider depth wins ties. This is an editorial review queue, not an automatic publishing rule.</p></div><span className="badge neutral">{stale} stale 180+ days</span></div>
    {reviewQueue.length?<div className="grid grid-3">{reviewQueue.map(x=><div className="card" key={x.marketKey}><div className="kpi">{x.providers} providers · {x.copyChars.toLocaleString()} copy chars</div><h3>{x.category} in {x.city}, IL</h3><p className="small muted">{x.seo?.index_mode==='noindex'?'Manual noindex':x.seo?.reviewed?'Reviewed':'Needs review'} · updated {x.seo?.updated_at?new Date(String(x.seo.updated_at)).toLocaleDateString():'unknown'}</p>{x.citySlug&&x.categorySlug&&<a href={`/illinois/${x.citySlug}/${x.categorySlug}`} target="_blank" rel="noreferrer">Review public page →</a>}</div>)}</div>:<div className="notice">No eligible pages currently fall below the copy-review threshold.</div>}

    {missing.length>0&&<><div className="section-head" style={{marginTop:28}}><div><h3>Eligible pages missing SEO records</h3><p className="small muted">These have enough live inventory to deserve editorial review, but no matching SEO record was found.</p></div></div><div className="grid grid-3">{missing.slice(0,12).map(x=><div className="card" key={x.marketKey}><div className="kpi">{x.providers} providers</div><h3>{x.category} in {x.city}, IL</h3>{x.citySlug&&x.categorySlug&&<a href={`/illinois/${x.citySlug}/${x.categorySlug}`} target="_blank" rel="noreferrer">Review public page →</a>}</div>)}</div></>}

    {protectedRows.length>0&&<p className="small muted" style={{marginTop:18}}>{protectedRows.length} existing SEO record{protectedRows.length===1?' remains':'s remain'} protected by the runtime inventory threshold because live provider depth is below three.</p>}
  </section>
}
