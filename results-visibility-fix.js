// Result visibility diagnostics + stale hidden-filter recovery.
function rvfBroadVisibleFilters(){
  const f=state.filters||{};
  return !String(f.q||'').trim() && (f.temp||'ALL')==='ALL' && (f.web||'ALL')==='ALL' && (f.maps||'ALL')==='ALL' && (f.contact||'ALL')==='ALL' && (f.gbp||'ALL')==='ALL' && (f.ageMin??'ALL')==='ALL' && (f.ageMax??'ALL')==='ALL' && !f.lowFruit && (f.freshness||'ALL')==='ALL' && (f.priorityBand||'ALL')==='ALL' && (f.serviceNeed||'ALL')==='ALL';
}
function rvfActiveFilters(){
  const f=state.filters||{},a=[];
  if(String(f.q||'').trim())a.push(`Search text: ${f.q}`);
  if((f.temp||'ALL')!=='ALL')a.push(`Temperature: ${f.temp}`);
  if((f.web||'ALL')!=='ALL')a.push(`Website: ${f.web}`);
  if((f.maps||'ALL')!=='ALL')a.push(`Maps: ${f.maps}`);
  if((f.contact||'ALL')!=='ALL')a.push(`Contact: ${f.contact}`);
  if((f.gbp||'ALL')!=='ALL')a.push(`GBP: ${f.gbp}`);
  if((f.ageMin??'ALL')!=='ALL')a.push(`Min age: ${f.ageMin}+ years`);
  if((f.ageMax??'ALL')!=='ALL')a.push(`Max age: ${f.ageMax} years`);
  if(f.lowFruit)a.push('Low-Hanging Fruit only');
  if((f.freshness||'ALL')!=='ALL')a.push(`Website freshness: ${f.freshness}`);
  if((f.quickWin||'ALL')!=='ALL')a.push(`Quick Win: ${typeof qwLabel==='function'?qwLabel(f.quickWin):f.quickWin}`);
  if((f.priorityBand||'ALL')!=='ALL')a.push(`Priority: ${f.priorityBand}`);
  if((f.serviceNeed||'ALL')!=='ALL')a.push(`Service: ${f.serviceNeed} ${Number(f.serviceMin||0)}+`);
  if(state.prod?.idealOn)a.push('My Ideal Prospect');
  return a;
}
function rvfBandCounts(){
  const c={PRIME:0,STRONG:0,POSSIBLE:0,LOW:0};
  for(const l of state.results||[]){const g=lowHangingScore(l).grade||'LOW';if(c[g]!=null)c[g]++}
  return c;
}
function rvfClearAllFilters(){
  const f=state.filters||{};
  Object.assign(f,{q:'',temp:'ALL',web:'ALL',maps:'ALL',contact:'ALL',gbp:'ALL',ageMin:'ALL',ageMax:'ALL',lowFruit:false,freshness:'ALL',quickWin:'ALL',priorityBand:'ALL',serviceNeed:'ALL',serviceMin:50});
  if(state.prod)state.prod.idealOn=false;
  render();toast(`Showing all ${state.results?.length||0} businesses from this search.`);
}
function rvfTryReleaseStaleHiddenFilter(){
  if(!(state.results?.length)||visible().length||!rvfBroadVisibleFilters())return false;
  const oldIdeal=!!state.prod?.idealOn,oldQuick=state.filters?.quickWin||'ALL';
  const hidden=[];if(oldIdeal)hidden.push('ideal');if(oldQuick!=='ALL')hidden.push('quick');
  if(hidden.length!==1)return false;
  if(oldIdeal)state.prod.idealOn=false;
  if(oldQuick!=='ALL')state.filters.quickWin='ALL';
  const now=visible().length;
  if(now>0){toast(`${state.results.length} businesses found. A previous ${oldIdeal?'My Ideal Prospect':'Quick Win'} filter was hiding all results, so it was cleared.`);return true}
  if(oldIdeal)state.prod.idealOn=true;
  if(oldQuick!=='ALL')state.filters.quickWin=oldQuick;
  return false;
}
function rvfResultsSummaryHtml(){
  const total=state.results?.length||0;if(!total)return'';const shown=visible().length,c=rvfBandCounts(),active=rvfActiveFilters();
  return `<div id="rvfResultsSummary" class="notice" style="margin:12px 15px 0;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>${total} found · ${shown} showing</b><div class="sub">PRIME ${c.PRIME} · STRONG ${c.STRONG} · POSSIBLE ${c.POSSIBLE} · LOW ${c.LOW}${active.length?` · Active filters: ${esc(active.join(' · '))}`:' · No restrictive filters active'}</div></div>${active.length?'<button class="btn" onclick="rvfClearAllFilters()">Clear All Filters</button>':''}</div>`;
}
function rvfPatchEmptyState(){
  if(state.view!=='search'||!(state.results?.length))return;const market=[...document.querySelectorAll('.panel')].find(p=>p.textContent.includes('MARKET RESULTS'));if(!market)return;
  const shown=visible().length,empty=market.querySelector('.empty');if(!shown&&empty){const active=rvfActiveFilters();empty.innerHTML=`<b>${state.results.length} businesses were found, but 0 match the current filters.</b><div class="sub" style="margin:8px 0 14px">${active.length?`Active filters: ${esc(active.join(' · '))}`:'A stale hidden filter is blocking the results.'}</div><button class="btn primary" onclick="rvfClearAllFilters()">Clear All Filters & Show ${state.results.length}</button>`}
}
function rvfInjectSummary(){
  if(state.view!=='search'||!(state.results?.length))return;const market=[...document.querySelectorAll('.panel')].find(p=>p.textContent.includes('MARKET RESULTS'));if(!market)return;
  if(!document.getElementById('rvfResultsSummary')){const filters=market.querySelector('.filters');if(filters)filters.insertAdjacentHTML('beforebegin',rvfResultsSummaryHtml());else market.querySelector('.head')?.insertAdjacentHTML('afterend',rvfResultsSummaryHtml())}
  rvfPatchEmptyState();
}
const rvfGenerateBase=generate;
generate=async function(){await rvfGenerateBase();if(rvfTryReleaseStaleHiddenFilter())render();else render()};
const rvfRenderBase=render;
render=function(){rvfRenderBase();queueMicrotask(rvfInjectSummary)};
render();
