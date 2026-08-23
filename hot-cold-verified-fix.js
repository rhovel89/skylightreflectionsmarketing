// HOT/COLD alignment: use current verified marketing-need logic, not legacy stored temp values.
// HOT/COLD describes marketing opportunity only — never buying intent.
function hcvNeed(l){
  try{
    if(typeof lowHangingScore==='function'){
      const x=lowHangingScore(l);
      if(Number.isFinite(+x?.needScore))return Math.max(0,Math.min(100,Math.round(+x.needScore)));
    }
    if(typeof pnfNeedScore==='function'){
      const x=pnfNeedScore(l);
      if(Number.isFinite(+x?.score))return Math.max(0,Math.min(100,Math.round(+x.score)));
    }
  }catch{}
  return Number.isFinite(+l?.marketingNeedScore)?Math.max(0,Math.min(100,Math.round(+l.marketingNeedScore))):0;
}
function hcvTemp(l){return hcvNeed(l)>=50?'HOT':'COLD'}
function hcvMeaning(l){const n=hcvNeed(l);return n>=50?'Strong Verified Marketing Need':n>=35?'Meaningful Verified Marketing Need':n>=20?'Moderate Verified Marketing Need':'Limited Verified Marketing Need'}
function hcvSyncLead(l){
  if(!l)return l;
  const n=hcvNeed(l);
  l.marketingNeedScore=n;
  l.temp=hcvTemp(l);
  l.marketingNeedMeaning=hcvMeaning(l);
  return l;
}
function hcvSyncAll(){
  for(const l of state.results||[])hcvSyncLead(l);
  for(const l of state.saved||[])hcvSyncLead(l);
  if(state.selected)hcvSyncLead(state.selected);
}

// Existing filter wrappers still work; sync the current temperature before they evaluate.
const hcvVisibleBase=visible;
visible=function(){hcvSyncAll();return hcvVisibleBase()};

// Keep newly scored/enriched leads aligned too.
const hcvScoreBase=score;
score=function(l){
  const old=hcvScoreBase(l)||{};
  const n=hcvNeed(l);
  return {...old,temp:n>=50?'HOT':'COLD',marketingNeedScore:n,marketingNeedMeaning:hcvMeaning(l)};
};

function hcvCounts(){
  const a=state.results||[];let hot=0,cold=0;
  for(const l of a)(hcvTemp(l)==='HOT'?hot++:cold++);
  return{hot,cold,total:a.length};
}
function hcvPatchUi(){
  if(!cloud?.session||state.view!=='search')return;
  hcvSyncAll();
  // Make the dropdown self-explanatory without changing its values.
  const sel=[...document.querySelectorAll('.filters select')].find(s=>[...s.options].some(o=>o.value==='HOT')&&[...s.options].some(o=>o.value==='COLD'));
  if(sel){
    const all=[...sel.options].find(o=>o.value==='ALL'),hot=[...sel.options].find(o=>o.value==='HOT'),cold=[...sel.options].find(o=>o.value==='COLD');
    if(all)all.textContent='HOT + COLD · All Marketing Need';
    if(hot)hot.textContent='HOT · 50–100 Verified Need';
    if(cold)cold.textContent='COLD · 0–49 Verified Need';
  }
  const c=hcvCounts();
  const summary=document.getElementById('rvfResultsSummary');
  if(summary&&!summary.querySelector('.hcvCounts')){
    const sub=summary.querySelector('.sub');
    if(sub)sub.insertAdjacentHTML('afterbegin',`<span class="hcvCounts"><b style="color:var(--red)">HOT ${c.hot}</b> · <b style="color:var(--green)">COLD ${c.cold}</b> · </span>`);
  }
  // Patch the generic opportunity cell to show the current verified-need number/meaning.
  const market=[...document.querySelectorAll('.panel')].find(p=>p.textContent.includes('MARKET RESULTS'));
  const rows=market?.querySelectorAll('tbody tr')||[];
  const shown=visible();
  rows.forEach((tr,i)=>{
    const l=shown[i];if(!l)return;
    const cells=tr.querySelectorAll('td');if(cells.length<2)return;
    const cell=[...cells].find(td=>td.querySelector('.score'));
    if(!cell)return;
    const sc=cell.querySelector('.score'),sub=cell.querySelector('.sub');
    if(sc){sc.textContent=String(hcvNeed(l));sc.className='score '+(hcvTemp(l)==='HOT'?'hot':'cold')}
    if(sub)sub.textContent=`${hcvTemp(l)} · ${hcvMeaning(l)}`;
  });
}

// HOT/COLD counts in the summary cards should also follow current verified need.
const hcvRenderBase=render;
render=function(){hcvSyncAll();hcvRenderBase();queueMicrotask(hcvPatchUi)};

// Results diagnostics should state HOT/COLD as an active filter clearly.
if(typeof rvfActiveFilters==='function'){
  const hcvActiveBase=rvfActiveFilters;
  rvfActiveFilters=function(){const a=hcvActiveBase();return a.map(x=>x==='Temperature: HOT'?'Marketing Need: HOT 50–100':x==='Temperature: COLD'?'Marketing Need: COLD 0–49':x)};
}

render();
