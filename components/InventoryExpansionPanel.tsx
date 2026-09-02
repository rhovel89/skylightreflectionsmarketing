type BranchRow={city?:string|null;business_id?:string|null};
type CategoryRow={business_id?:string|null;categories?:{name?:string|null;slug?:string|null;vertical?:string|null}|null};
type LocationRow={name:string;slug:string};
type SearchRow={service?:string|null;location?:string|null;result_count?:number|null;created_at?:string|null};

type Market={key:string;city:string;citySlug:string;category:string;categorySlug:string;vertical:string;providers:number;cityBusinesses:number;localSearches:number;zeroResults:number;generalSearches:number;score:number};

const norm=(value:string)=>value.trim().toLowerCase();
const marketKey=(city:string,category:string)=>`${norm(city)}::${norm(category)}`;
const protectedMarkets=new Map<string,string>([
  [marketKey('Pontiac','Cafes & Coffee'),'Intentional editorial exception: keep this market at two legitimate providers and noindex until a genuinely strong third physical business is found. Do not add a weak or fabricated listing simply to unlock the page.'],
]);

export function InventoryExpansionPanel({branches,businessCategories,locations,searchEvents}:{branches:BranchRow[];businessCategories:CategoryRow[];locations:LocationRow[];searchEvents:SearchRow[]}){
  const categoriesByBusiness=new Map<string,{name:string;slug:string;vertical:string}[]>();
  for(const row of businessCategories){
    const businessId=String(row.business_id||'');
    const category=row.categories;
    const name=String(category?.name||'').trim();
    const slug=String(category?.slug||'').trim();
    const vertical=String(category?.vertical||'').trim();
    if(!businessId||!name||!slug)continue;
    const current=categoriesByBusiness.get(businessId)||[];
    if(!current.some(item=>item.slug===slug))current.push({name,slug,vertical});
    categoriesByBusiness.set(businessId,current);
  }

  const cityBusinessSets=new Map<string,Set<string>>();
  const providerSets=new Map<string,Set<string>>();
  const marketMeta=new Map<string,{city:string;category:string;categorySlug:string;vertical:string}>();
  for(const branch of branches){
    const city=String(branch.city||'').trim();
    const businessId=String(branch.business_id||'');
    if(!city||!businessId)continue;
    const cityKey=norm(city);
    if(!cityBusinessSets.has(cityKey))cityBusinessSets.set(cityKey,new Set());
    cityBusinessSets.get(cityKey)!.add(businessId);
    for(const category of categoriesByBusiness.get(businessId)||[]){
      const key=marketKey(city,category.name);
      if(!providerSets.has(key))providerSets.set(key,new Set());
      providerSets.get(key)!.add(businessId);
      marketMeta.set(key,{city,category:category.name,categorySlug:category.slug,vertical:category.vertical});
    }
  }

  const localDemand=new Map<string,{searches:number;zero:number}>();
  const generalDemand=new Map<string,number>();
  for(const event of searchEvents){
    const service=String(event.service||'').trim();
    if(!service)continue;
    const location=String(event.location||'').trim();
    if(location){
      const key=marketKey(location,service);
      const current=localDemand.get(key)||{searches:0,zero:0};
      current.searches+=1;
      if(Number(event.result_count||0)===0)current.zero+=1;
      localDemand.set(key,current);
    }else generalDemand.set(norm(service),(generalDemand.get(norm(service))||0)+1);
  }

  const markets:Market[]=[];
  for(const [key,set] of providerSets){
    const meta=marketMeta.get(key);if(!meta)continue;
    const providers=set.size;if(providers<1||providers>=3)continue;
    const location=locations.find(item=>norm(item.name)===norm(meta.city));
    if(!location)continue;
    const cityBusinesses=cityBusinessSets.get(norm(meta.city))?.size||0;
    if(cityBusinesses<3)continue;
    const demand=localDemand.get(key)||{searches:0,zero:0};
    const general=generalDemand.get(norm(meta.category))||0;
    const score=(providers===2?100:40)+Math.min(cityBusinesses*2,60)+(demand.searches*30)+(demand.zero*20)+(general*5);
    markets.push({key,city:meta.city,citySlug:location.slug,category:meta.category,categorySlug:meta.categorySlug,vertical:meta.vertical,providers,cityBusinesses,localSearches:demand.searches,zeroResults:demand.zero,generalSearches:general,score});
  }

  const protectedRows=markets.filter(row=>protectedMarkets.has(row.key));
  const opportunities=markets.filter(row=>!protectedMarkets.has(row.key)).sort((a,b)=>b.score-a.score||b.providers-a.providers||b.cityBusinesses-a.cityBusinesses||a.city.localeCompare(b.city)||a.category.localeCompare(b.category));
  const oneAway=opportunities.filter(row=>row.providers===2);
  const deeper=opportunities.filter(row=>row.providers===1);
  const recentDemand=searchEvents.length;

  return <>
    <section className="admin-card">
      <div className="section-head"><div><div className="kpi">Private growth intelligence</div><h2>Local Inventory Expansion Engine</h2><p className="muted">Ranks underfilled city/category markets from live published-business inventory and recent directory-search signals. It does not unlock pages by itself and never overrides the three-provider indexing rule.</p></div></div>
      <div className="grid grid-4">
        <div className="card"><div className="kpi">Underfilled markets</div><h2>{markets.length}</h2><p className="small muted">1–2 real published providers in an established city</p></div>
        <div className="card"><div className="kpi">One provider away</div><h2>{oneAway.length}</h2><p className="small muted">Unprotected quick wins at exactly two providers</p></div>
        <div className="card"><div className="kpi">Deeper opportunities</div><h2>{deeper.length}</h2><p className="small muted">Markets currently starting from one provider</p></div>
        <div className="card"><div className="kpi">Demand events loaded</div><h2>{recentDemand}</h2><p className="small muted">Recent search signals used as a secondary ranking input</p></div>
      </div>
      <div className="notice" style={{marginTop:18}}><strong>Research integrity:</strong> add only real physical branches supported by current source evidence. Researched/imported businesses default to Claimed = false, Verified = false, Featured = false, Rating = 0 and Review Count = 0. Paid placement never changes organic ranking.</div>
    </section>

    {protectedRows.length>0&&<section className="admin-card"><div className="section-head"><div><div className="kpi">Protected editorial exceptions</div><h2>Do Not Force the Threshold</h2><p className="muted">These markets are intentionally excluded from the growth queue.</p></div></div><div className="grid grid-3">{protectedRows.map(row=><div className="card" key={row.key}><div className="kpi">{row.providers}/3 providers · protected</div><h3>{row.category} in {row.city}, IL</h3><p className="small muted">{protectedMarkets.get(row.key)}</p><a href={`/illinois/${row.citySlug}/${row.categorySlug}`} target="_blank" rel="noreferrer">Review protected public page →</a></div>)}</div></section>}

    <section className="admin-card">
      <div className="section-head"><div><div className="kpi">Highest-value research queue</div><h2>Next Markets to Expand</h2><p className="muted">Provider proximity leads the score, followed by established city inventory and real search demand. Search volume is intentionally a secondary signal while traffic is still small.</p></div><span className="badge neutral">Top {Math.min(opportunities.length,18)}</span></div>
      {opportunities.length?<div className="grid grid-3">{opportunities.slice(0,18).map((row,index)=><div className="card" key={row.key}><div className="kpi">#{index+1} · score {row.score} · {row.providers}/3 providers</div><h3>{row.category} in {row.city}, IL</h3><p className="small muted">Need {3-row.providers} more legitimate provider{3-row.providers===1?'':'s'} · {row.cityBusinesses} published businesses in city · {row.localSearches} local search{row.localSearches===1?'':'es'} · {row.zeroResults} zero-result search{row.zeroResults===1?'':'es'}{row.generalSearches?` · ${row.generalSearches} general ${row.category} search${row.generalSearches===1?'':'es'}`:''}</p><p className="small muted">Vertical: {row.vertical||'local business'}. Research official business sites, city/chamber/tourism directories and other current primary evidence before adding anything.</p><a href={`/illinois/${row.citySlug}/${row.categorySlug}`} target="_blank" rel="noreferrer">Review current market →</a></div>)}</div>:<div className="notice">No unprotected underfilled markets are currently available in established cities.</div>}
    </section>
  </>;
}
