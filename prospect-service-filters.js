state.filters.priorityBand=state.filters.priorityBand||'ALL';
state.filters.serviceNeed=state.filters.serviceNeed||'ALL';
state.filters.serviceMin=Number.isFinite(+state.filters.serviceMin)?+state.filters.serviceMin:50;

function psfPriorityPass(l){
  const s=lowHangingScore(l).score,b=state.filters.priorityBand;
  if(b==='PRIME')return s>=75;
  if(b==='STRONG')return s>=60&&s<75;
  if(b==='POSSIBLE')return s>=45&&s<60;
  if(b==='LOW')return s<45;
  return true;
}
function psfServiceObj(l,key){
  const s=p15ServiceScores(l);
  if(key==='WEB')return s.website;
  if(key==='SEO')return s.seo;
  if(key==='FUNNEL')return s.funnel;
  return null;
}
function psfServicePass(l){
  const key=state.filters.serviceNeed;if(key==='ALL')return true;
  const o=psfServiceObj(l,key),n=o?.score;
  return n!=null&&Number(n)>=Number(state.filters.serviceMin||0);
}
const psfVisibleBase=visible;
visible=function(){return psfVisibleBase().filter(l=>psfPriorityPass(l)&&psfServicePass(l))};

const psfFilterBase=filterHtml;
filterHtml=function(){
  let h=psfFilterBase();
  const b=state.filters.priorityBand,k=state.filters.serviceNeed,m=+state.filters.serviceMin;
  const extra=`<select title="Prospect priority" onchange="state.filters.priorityBand=this.value;render()"><option value="ALL">Any priority score</option><option value="PRIME" ${b==='PRIME'?'selected':''}>PRIME 75–100 · Contact First</option><option value="STRONG" ${b==='STRONG'?'selected':''}>STRONG 60–74 · Good Prospect</option><option value="POSSIBLE" ${b==='POSSIBLE'?'selected':''}>POSSIBLE 45–59 · Worth Reviewing</option><option value="LOW" ${b==='LOW'?'selected':''}>LOW 0–44 · Lower Priority</option></select><select title="Service opportunity" onchange="state.filters.serviceNeed=this.value;render()"><option value="ALL">Any service need</option><option value="WEB" ${k==='WEB'?'selected':''}>Web Design opportunity</option><option value="SEO" ${k==='SEO'?'selected':''}>SEO opportunity</option><option value="FUNNEL" ${k==='FUNNEL'?'selected':''}>Funnel Design opportunity</option></select><select title="Minimum verified service opportunity" onchange="state.filters.serviceMin=+this.value;render()" ${k==='ALL'?'disabled':''}><option value="50" ${m===50?'selected':''}>Service need 50+ · Moderate+</option><option value="70" ${m===70?'selected':''}>Service need 70+ · Strong+</option><option value="85" ${m===85?'selected':''}>Service need 85+ · Very Strong</option></select>`;
  return h.replace(/<\/div>$/i,extra+'</div>');
};

function psfServiceLines(l){
  const svc=p15ServiceScores(l),labels={WEB:'Web Design',SEO:'SEO',FUNNEL:'Funnel'},entries=state.filters.serviceNeed==='ALL'?[['WEB',svc.website],['SEO',svc.seo],['FUNNEL',svc.funnel]]:[[state.filters.serviceNeed,psfServiceObj(l,state.filters.serviceNeed)]];
  const known=entries.filter(([,o])=>o?.score!=null).sort((a,b)=>b[1].score-a[1].score);
  if(!known.length)return '<span class="sub">Needs verified audit data</span>';
  return known.map(([key,o])=>`<div style="margin:2px 0"><b>${labels[key]}</b> ${Math.round(o.score)}/100<div class="sub">${smServiceMeaning(o.score)}</div></div>`).join('');
}

table=function(a){
  a=(a||[]).map(applyLowHanging);if(!a.length)return `<div class="empty">No leads match the current priority/service filters. Try another band, lower the service threshold, or run enrichment for more verified data.</div>`;
  return `<div class="tablewrap"><table class="table"><thead><tr><th>BUSINESS</th><th>LOW-HANGING</th><th>AGE</th><th>CONTACT</th><th>WEBSITE</th><th>SERVICE NEED</th><th>GOOGLE</th><th>OPPORTUNITY</th><th>ACTIONS</th></tr></thead><tbody>${a.map(l=>{const saved=findSaved(l),lh=lowHangingScore(l),audit=l.website&&l.auditChecked===true&&Number.isFinite(+l.webScore)?`${p3AuditLabel(l)} · ${smWebsiteMeaning(l.webScore)}`:p3AuditLabel(l);return`<tr><td class="biz"><b>${esc(l.name)}</b><div class="sub">${esc(l.address)}</div><span class="tag">${esc(l.niche)}</span>${lh.score>=75?'<span class="tag good">PRIME TARGET</span>':lh.score>=60?'<span class="tag good">LOW-HANGING</span>':''}</td><td><span class="score ${lh.score>=60?'hot':'cold'}">${lh.score}</span><div class="sub"><b>${lh.grade}</b> · ${smLowMeaning(lh.score)}</div></td><td><b>${ageYears(l)==null?'Unchecked':`~${Math.round(ageYears(l))} yrs`}</b><div class="sub">${esc(l.businessAgeConfidence||'')}</div></td><td>${esc(l.phone||'No phone')}<div class="sub">${esc(l.email||'Email unchecked')}</div></td><td>${l.website?`<a href="${esc(l.website)}" target="_blank" rel="noopener" style="color:var(--cyan)">${esc(domain(l.website))}</a>`:'<span class="tag bad">No website</span>'}<div class="sub">Audit: ${audit} · ${esc(bpFreshnessLabel(l))}</div></td><td>${psfServiceLines(l)}</td><td>★ ${l.rating||'—'} · ${Number.isFinite(+l.reviews)&&+l.reviews>0?l.reviews:'—'} reviews<div class="sub">Maps: ${p3MapsLabel(l)}</div></td><td><span class="score ${l.temp==='HOT'?'hot':'cold'}">${l.score}</span><div class="sub"><b>${l.temp}</b> · ${smOpportunityMeaning(l.score)}</div></td><td><button class="btn" onclick="openLead('${l.id}')">Details</button> ${saved?'<span class="tag good">Saved</span>':`<button class="btn primary" onclick="saveLead(state.results.find(x=>x.id==='${l.id}'))">Save</button>`}</td></tr>`}).join('')}</tbody></table></div>`;
};

bpTopProspectsHtml=function(){
  if(state.view!=='search'||!state.results.length)return'';
  const top=[...visible()].map(applyLowHanging).sort((a,b)=>(b.lowHangingScore-a.lowHangingScore)||(b.score-a.score)).slice(0,5);
  if(!top.length)return `<div id="bestProspectsPanel" class="panel" style="margin-bottom:14px"><div class="head"><div><div class="eyebrow">BEST PROSPECTS</div><h2>No prospects match the selected priority/service need</h2></div></div><div class="empty">Adjust the PRIME band or service opportunity filter to broaden the list.</div></div>`;
  const filterNote=[state.filters.priorityBand!=='ALL'?state.filters.priorityBand:null,state.filters.serviceNeed!=='ALL'?({WEB:'Web Design',SEO:'SEO',FUNNEL:'Funnel Design'}[state.filters.serviceNeed]+' '+state.filters.serviceMin+'+'):null].filter(Boolean).join(' · ');
  return `<div id="bestProspectsPanel" class="panel" style="margin-bottom:14px"><div class="head"><div><div class="eyebrow">BEST PROSPECTS</div><h2>Low-hanging fruit ranked for you</h2>${filterNote?`<div class="sub">Filtered: ${esc(filterNote)}</div>`:''}</div><span class="tag good">FREE VERIFIED SIGNALS</span></div><div style="padding:12px 14px;display:grid;gap:8px">${top.map((l,i)=>{const x=lowHangingScore(l),why=x.reasons.slice(0,3).map(r=>r[0]).join(' · '),svc=state.filters.serviceNeed==='ALL'?p15ServiceScores(l).best:({key:state.filters.serviceNeed,label:{WEB:'Web Design',SEO:'SEO',FUNNEL:'Funnel Design'}[state.filters.serviceNeed],score:psfServiceObj(l,state.filters.serviceNeed)?.score});return`<button class="card" style="margin:0;text-align:left;width:100%" onclick="openLead('${l.id}')"><b>#${i+1} · ${esc(l.name)}</b><span style="float:right;text-align:right"><span class="score ${x.score>=60?'hot':'cold'}">${x.score}</span><span class="sub" style="display:block">${x.grade} · ${smLowMeaning(x.score)}</span></span><div class="sub" style="clear:both;padding-top:4px">${esc(why||'Needs more enrichment')} · ${svc?.score!=null?`${esc(svc.label)} ${Math.round(svc.score)}/100 · ${smServiceMeaning(svc.score)}`:`Opportunity ${l.score}/100 · ${smOpportunityMeaning(l.score)}`}</div></button>`}).join('')}</div></div>`;
};

const psfRenderBase=render;
render=function(){psfRenderBase();const conn=document.querySelector('.conn');if(conn){let row=document.getElementById('serviceFilterStatus');if(!row){row=document.createElement('div');row.className='prov';row.id='serviceFilterStatus';conn.appendChild(row)}row.innerHTML='<span>Web · SEO · Funnel Filters</span><b style="color:var(--green)">LIVE</b>'}};
render();
