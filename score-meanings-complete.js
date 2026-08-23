function smcLowMeaning(n){n=Number(n)||0;return n>=75?'Contact First':n>=60?'Good Prospect':n>=45?'Worth Reviewing':'Lower Priority / Needs More Data'}
function smcOpportunityMeaning(n){n=Number(n)||0;return n>=80?'Very High Marketing Need':n>=60?'Strong Marketing Need':n>=40?'Moderate Marketing Need':'Lower Marketing Need'}
function smcWebsiteMeaning(n){n=Number(n)||0;return n>=80?'Strong Website':n>=60?'Average Website':n>=40?'Weak Website':'Poor Website'}
function smcServiceMeaning(n){if(n==null)return'Needs Verified Data';n=Number(n)||0;return n>=85?'Very Strong Sales Opportunity':n>=70?'Strong Sales Opportunity':n>=50?'Moderate Sales Opportunity':n>=25?'Limited Sales Opportunity':'Low Sales Opportunity'}
function smcDataMeaning(n){n=Number(n)||0;return n>=80?'Excellent Coverage':n>=65?'Good Coverage':n>=45?'Partial Coverage':'Thin Data'}

smLowMeaning=smcLowMeaning;
smOpportunityMeaning=smcOpportunityMeaning;
smWebsiteMeaning=smcWebsiteMeaning;
smServiceMeaning=smcServiceMeaning;
smDataMeaning=smcDataMeaning;

const smcSearchBase=searchView;
searchView=function(){
  let h=smcSearchBase();
  const v=visible(),avg=v.length?Math.round(v.reduce((a,b)=>a+(Number(b.score)||0),0)/v.length):0;
  const old=`<span>Avg Opportunity</span><b>${avg}/100</b>`;
  const neu=`<span>Avg Opportunity</span><b>${avg}/100</b><div class="sub"><b>${smcOpportunityMeaning(avg)}</b></div>`;
  return h.replace(old,neu);
};

const smcPipelineBase=pipelineView;
pipelineView=function(){
  let h=smcPipelineBase();
  for(const l of state.saved||[]){
    const old=`${esc(l.city)}, ${esc(l.state)} · ${l.score}/100 ${l.temp}`;
    const neu=`${esc(l.city)}, ${esc(l.state)} · ${l.score}/100 ${l.temp} · ${smcOpportunityMeaning(l.score)}`;
    h=h.replace(old,neu);
  }
  return h;
};

const smcSourceResultsBase=sourceResultsTable;
sourceResultsTable=function(a){
  let h=smcSourceResultsBase(a);
  for(const l of a||[]){
    const cls=l.temp==='HOT'?'hot':'cold';
    const old=`<span class="score ${cls}">${l.score}</span><div class="sub">${l.temp}</div>`;
    const neu=`<span class="score ${cls}">${l.score}</span><div class="sub"><b>${l.temp}</b> · ${smcOpportunityMeaning(l.score)}</div>`;
    h=h.replace(old,neu);
  }
  return h;
};

const smcWorkBase=pWorkView;
pWorkView=function(){
  let h=smcWorkBase();
  for(const l of pWorkRows()){
    const cls=l.lowHangingScore>=60?'hot':'cold';
    const old=`<span class="score ${cls}">${l.lowHangingScore}</span>`;
    const neu=`<span class="score ${cls}">${l.lowHangingScore}</span><div class="sub"><b>${l.lowHangingGrade||lowHangingScore(l).grade}</b> · ${smcLowMeaning(l.lowHangingScore)}</div>`;
    h=h.replace(old,neu);
  }
  return h;
};

const smcPriorityBase=p5PriorityHtml;
p5PriorityHtml=function(){
  let h=smcPriorityBase(),p=p5PriorityData();
  for(const l of p.next||[]){
    const kind=l.followUp&&l.followUp<=p5Today()?'FOLLOW-UP':'HOT';
    const old=`${esc(kind)} · ${esc(l.name)} · ${l.score}</button>`;
    const neu=`${esc(kind)} · ${esc(l.name)} · ${l.score}/100 · ${smcOpportunityMeaning(l.score)}</button>`;
    h=h.replace(old,neu);
  }
  return h;
};

const smcBriefBase=pBrief;
pBrief=function(l){
  const b=smcBriefBase(l),lh=lowHangingScore(l),w=Math.round(Number(l.webScore)||0);
  b.headline=String(b.headline||'').replace(`${lh.score}/100 ${lh.grade} prospect`,`${lh.score}/100 ${lh.grade} · ${smcLowMeaning(lh.score)} prospect`);
  if(l.website&&l.auditChecked===true)b.summary=String(b.summary||'').replace(`website ${w}/100`,`website ${w}/100 · ${smcWebsiteMeaning(w)}`);
  return b;
};

function smcHasMeaning(text){return /Contact First|Good Prospect|Worth Reviewing|Lower Priority|Marketing Need|Strong Website|Average Website|Weak Website|Poor Website|Sales Opportunity|Verified Data|Excellent Coverage|Good Coverage|Partial Coverage|Thin Data/i.test(String(text||''))}
function smcAddMeaning(el,meaning){
  if(!el||!meaning||smcHasMeaning(el.parentElement?.textContent)||el.parentElement?.querySelector('.smcMeaningInline'))return;
  const s=document.createElement('span');s.className='smcMeaningInline';s.textContent=' · '+meaning;el.insertAdjacentElement('afterend',s);
}
function smcTableHeaderFor(el){
  const td=el.closest('td'),table=el.closest('table');if(!td||!table)return'';
  const cells=[...td.parentElement.children],i=cells.indexOf(td),ths=[...table.querySelectorAll('thead th')];return String(ths[i]?.textContent||'').trim().toUpperCase();
}
function smcAnnotateKv(){
  document.querySelectorAll('.kv').forEach(kv=>{
    const c=[...kv.children];
    for(let i=0;i<c.length-1;i+=2){
      const label=String(c[i]?.textContent||'').trim().toLowerCase(),val=c[i+1],m=String(val?.textContent||'').match(/(\d{1,3})\s*\/\s*100/);if(!m||smcHasMeaning(val.textContent))continue;
      const n=+m[1];let meaning='';
      if(label.includes('low-hanging'))meaning=smcLowMeaning(n);
      else if(label.includes('opportunity'))meaning=smcOpportunityMeaning(n);
      else if(label.includes('audit score')||label.includes('website score')||label.includes('avg website'))meaning=smcWebsiteMeaning(n);
      else if(label.includes('data quality'))meaning=smcDataMeaning(n);
      else if(/web design|seo|funnel|social|ppc|google business/.test(label))meaning=smcServiceMeaning(n);
      if(meaning){const s=document.createElement('span');s.className='smcMeaningInline';s.textContent=' · '+meaning;val.appendChild(s)}
    }
  });
}
function smcAnnotateScores(){
  document.querySelectorAll('.score').forEach(el=>{
    if(smcHasMeaning(el.parentElement?.textContent))return;
    const m=String(el.textContent||'').match(/(\d{1,3})/);if(!m)return;const n=+m[1],head=smcTableHeaderFor(el),ctx=String(el.closest('.section,.stat,.card,.panel,td')?.textContent||'').toLowerCase();let meaning='';
    if(head.includes('LOW-HANGING')||head==='SCORE'&&state.view==='work'||ctx.includes('low-hanging fruit intelligence')||ctx.includes('prime target'))meaning=smcLowMeaning(n);
    else if(head.includes('DATA QUALITY')||ctx.includes('data quality'))meaning=smcDataMeaning(n);
    else if(head.includes('SERVICE NEED')||ctx.includes('service opportunity scores'))meaning=smcServiceMeaning(n);
    else if(head.includes('WEBSITE')&&ctx.includes('audit'))meaning=smcWebsiteMeaning(n);
    else if(head.includes('OPPORTUNITY')||/\bhot\b|\bcold\b/.test(String(el.parentElement?.textContent||'').toLowerCase()))meaning=smcOpportunityMeaning(n);
    if(meaning)smcAddMeaning(el,meaning);
  });
}
function smcAnnotateWebsiteAudit(){
  document.querySelectorAll('.section').forEach(sec=>{
    if(!/Website Marketing Audit/i.test(sec.textContent||''))return;
    const spans=[...sec.querySelectorAll('.kv>span')];
    for(let i=0;i<spans.length-1;i+=2){if(!/Audit score/i.test(spans[i].textContent||''))continue;const m=String(spans[i+1].textContent||'').match(/(\d{1,3})\s*\/\s*100/);if(m&&!smcHasMeaning(spans[i+1].textContent)){const s=document.createElement('span');s.className='smcMeaningInline';s.textContent=' · '+smcWebsiteMeaning(+m[1]);spans[i+1].appendChild(s)}}
  });
}
function smcAnnotateAll(){smcAnnotateKv();smcAnnotateScores();smcAnnotateWebsiteAudit()}

const smcToastBase=toast;
toast=function(t){let s=String(t||''),m;if((m=s.match(/Low-Hanging\s+(\d{1,3})\/100/i))&&!smcHasMeaning(s))s+=' · '+smcLowMeaning(+m[1]);else if((m=s.match(/website\s+(\d{1,3})\/100/i))&&!smcHasMeaning(s))s+=' · '+smcWebsiteMeaning(+m[1]);else if((m=s.match(/opportunity\s+(\d{1,3})\/100/i))&&!smcHasMeaning(s))s+=' · '+smcOpportunityMeaning(+m[1]);return smcToastBase(s)};

const smcRenderBase=render;
render=function(){smcRenderBase();if(!document.getElementById('smcMeaningStyles')){const s=document.createElement('style');s.id='smcMeaningStyles';s.textContent='.smcMeaningInline{font-size:10px;color:var(--muted);font-weight:800;white-space:normal}.score+.smcMeaningInline{margin-left:4px}.stat .smcMeaningInline{display:block;margin-top:3px}';document.head.appendChild(s)}queueMicrotask(smcAnnotateAll)};
render();