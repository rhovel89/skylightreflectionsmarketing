// Funnel / Lead Magnet Intelligence. Evidence-based website + linked public-page detection.
(function(){
  if(typeof state==='undefined')return;
  state.funnelScan=state.funnelScan||{running:false,leadId:null,manualType:'FUNNEL',manualUrl:'',manualNote:''};
  state.filters=state.filters||{};if(!state.filters.funnelPresence)state.filters.funnelPresence='ALL';
  const F=state.funnelScan;
  const fiStatusLabels={
    UNCHECKED:'Unchecked',NO_FUNNEL_FOUND:'No Funnel Found on Checked Sources',BASIC_FORM_ONLY:'Basic Contact / Lead Form Only',LEAD_MAGNET_FOUND:'Lead Magnet / Offer Found',FUNNEL_FOUND:'Confirmed Funnel / Conversion Path Found',FUNNEL_AND_LEAD_MAGNET:'Funnel + Lead Magnet Found'
  };
  function fiEsc(v){return typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function fiUrl(v){let s=String(v||'').trim();if(!s)return'';if(!/^https?:\/\//i.test(s))s='https://'+s;try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:''}catch{return''}}
  function fiIntel(l){return l?.funnelIntel||l?.funnel_intelligence||null}
  function fiStatus(l){return fiIntel(l)?.status||'UNCHECKED'}
  function fiLabel(l){const x=fiIntel(l);return x?.label||fiStatusLabels[fiStatus(l)]||'Unchecked'}
  function fiClass(status){return status==='NO_FUNNEL_FOUND'||status==='BASIC_FORM_ONLY'?'bad':status==='FUNNEL_FOUND'||status==='FUNNEL_AND_LEAD_MAGNET'||status==='LEAD_MAGNET_FOUND'?'good':''}
  function fiMaturityMeaning(n){n=Number(n)||0;return n>=80?'Strong Funnel System':n>=60?'Established Conversion Path':n>=40?'Some Lead Capture':n>=20?'Basic / Limited Funnel':'Little Funnel Evidence'}
  function fiOppMeaning(n){return typeof sgOppMeaning==='function'?sgOppMeaning(n):(n>=85?'Very Strong Sales Opportunity':n>=70?'Strong Sales Opportunity':n>=50?'Moderate Sales Opportunity':n>=25?'Limited Sales Opportunity':'Low Sales Opportunity')}

  // Persist funnel intelligence whenever a lead is saved later.
  if(typeof leadToDb==='function'){
    const fiBaseLeadToDb=leadToDb;leadToDb=function(l){const d=fiBaseLeadToDb(l),x=fiIntel(l);if(x){d.funnel_intelligence=x;d.funnel_checked_at=x.checkedAt||x.confirmedAt||null}return d};
  }
  if(typeof dbToLead==='function'){
    const fiBaseDbToLead=dbToLead;dbToLead=function(r){const l=fiBaseDbToLead(r);l.funnelIntel=r.funnel_intelligence||null;return l};
  }

  // Feed verified funnel evidence into Funnel Design opportunity without inventing weaknesses.
  if(typeof p15ServiceScores==='function'){
    const fiBaseServiceScores=p15ServiceScores;
    p15ServiceScores=function(l){
      const scores=fiBaseServiceScores(l),x=fiIntel(l);if(!x?.checked&&!x?.manualConfirmed)return scores;
      const old=scores.funnel||{score:null,confidence:'unchecked',why:[]};let n=old.score==null?null:Number(old.score),why=[...(old.why||[])];
      const st=x.status;
      if(st==='NO_FUNNEL_FOUND'){n=Math.max(n??0,90);why.unshift(`No funnel or lead magnet found across ${x.pagesChecked||0} checked website/source page${Number(x.pagesChecked||0)===1?'':'s'}`)}
      else if(st==='BASIC_FORM_ONLY'){n=Math.max(n??0,75);why.unshift('Only a basic form/contact path was detected; no stronger funnel or lead magnet was found on checked sources')}
      else if(st==='LEAD_MAGNET_FOUND'){n=n==null?55:Math.max(n,40);why.unshift('Lead magnet/offer detected; evaluate the follow-up and conversion path before pitching a replacement')}
      else if(st==='FUNNEL_FOUND'){n=n==null?35:n;why.unshift('A funnel/conversion path is already present; sell optimization only when other conversion weaknesses support it')}
      else if(st==='FUNNEL_AND_LEAD_MAGNET'){n=n==null?25:n;why.unshift('Both a funnel and lead magnet are present; focus on conversion optimization/tracking if evidence supports it')}
      scores.funnel={score:n==null?null:Math.max(0,Math.min(100,Math.round(n))),confidence:x.manualConfirmed?'manual-confirmed':'verified',why:[...new Set(why)].slice(0,8)};
      const labels={website:'Web Design',seo:'SEO',funnel:'Funnel Design',social:'Social Media',ppc:'PPC / Tracking',gbp:'Google Business Profile'},core=new Set(['website','seo','funnel']);
      const ranked=Object.entries(scores).filter(([k,v])=>labels[k]&&v?.score!=null).sort((a,b)=>((Number(b[1].score)+(core.has(b[0])?6:0))-(Number(a[1].score)+(core.has(a[0])?6:0)))||(Number(b[1].score)-Number(a[1].score)));
      scores.best=ranked[0]?{key:ranked[0][0],label:labels[ranked[0][0]],score:Number(ranked[0][1].score)}:null;return scores;
    };
  }

  async function fiPersist(l){
    const s=findSaved(l);if(!s||!isUuid(s.id)||!cloud?.session)return;
    const x=fiIntel(l),payload={funnel_intelligence:x||null,funnel_checked_at:x?.checkedAt||x?.confirmedAt||new Date().toISOString()};
    try{if(typeof p15ServiceScores==='function')payload.service_opportunity=p15ServiceScores(l)}catch{}
    const {error}=await sb.from('leads').update(payload).eq('id',s.id).eq('user_id',cloud.session.user.id);if(error)console.warn('Funnel intelligence save',error.message);
  }
  function fiApplyToState(original,intel){
    const update=l=>({...l,funnelIntel:intel});state.results=state.results.map(x=>(x.id===original.id||same(x,original))?update(x):x);state.saved=state.saved.map(x=>(x.id===original.id||same(x,original))?update(x):x);if(state.selected&&(state.selected.id===original.id||same(state.selected,original)))state.selected=update(state.selected);persist();
  }
  window.fiScan=async function(){
    const l=state.selected;if(!l||F.running)return;const website=fiUrl(l.website);if(!website)return toast('Add the business website first, then scan for funnels.');F.running=true;F.leadId=l.id;render();
    try{const {data,error}=await sb.functions.invoke('funnel-detect',{body:{website,businessName:l.name}});if(error)throw error;if(data?.error)throw new Error(data.error);const intel={...data,checkedAt:data.checkedAt||new Date().toISOString(),source:'free_website_linked_pages'};fiApplyToState(l,intel);await fiPersist({...l,funnelIntel:intel});const current=state.selected||l;if(typeof log==='function'&&isUuid(findSaved(current)?.id))log(findSaved(current)||current,'funnel_scan',`Funnel scan: ${intel.label||intel.status} · ${intel.pagesChecked||0} pages checked`);toast(intel.label||'Funnel scan complete.')}catch(e){toast('Funnel scan failed: '+(e?.message||'Unknown error'))}finally{F.running=false;F.leadId=null;render()}
  };
  window.fiManualType=v=>{F.manualType=v};window.fiManualUrl=v=>{F.manualUrl=v};window.fiManualNote=v=>{F.manualNote=v};
  window.fiSaveManual=async function(){
    const l=state.selected;if(!l)return;const u=fiUrl(F.manualUrl);if(!u)return toast('Paste a valid public funnel or lead-magnet URL.');const type=F.manualType||'FUNNEL',old=fiIntel(l)||{},e=[...(old.evidence||[])];e.unshift({type:type==='LEAD_MAGNET'?'manual_lead_magnet':'manual_funnel',label:type==='LEAD_MAGNET'?'Manually confirmed lead magnet':'Manually confirmed funnel / conversion page',url:u,detail:String(F.manualNote||'').trim()||'Confirmed during manual prospect research'});
    const hadFunnel=['FUNNEL_FOUND','FUNNEL_AND_LEAD_MAGNET'].includes(old.status)||type==='FUNNEL',hadMagnet=['LEAD_MAGNET_FOUND','FUNNEL_AND_LEAD_MAGNET'].includes(old.status)||type==='LEAD_MAGNET';const status=hadFunnel&&hadMagnet?'FUNNEL_AND_LEAD_MAGNET':hadFunnel?'FUNNEL_FOUND':'LEAD_MAGNET_FOUND';
    const intel={...old,checked:true,manualConfirmed:true,status,label:fiStatusLabels[status],confidence:'manual-confirmed',evidence:e.slice(0,30),checkedAt:new Date().toISOString(),confirmedAt:new Date().toISOString(),checkedScope:old.checkedScope||'Manual external evidence added by CRM user. This may include a funnel not linked from the main website.',maturityScore:status==='FUNNEL_AND_LEAD_MAGNET'?85:status==='FUNNEL_FOUND'?72:55,funnelOpportunitySignal:status==='FUNNEL_AND_LEAD_MAGNET'?25:status==='FUNNEL_FOUND'?35:55};
    let s=findSaved(l);if(!s){await saveLead({...l,funnelIntel:intel},true);s=findSaved({...l,funnelIntel:intel})}fiApplyToState(l,intel);await fiPersist({...l,id:s?.id||l.id,funnelIntel:intel});if(typeof log==='function'&&s)log(s,'manual_funnel_evidence',`${intel.label} · ${u}`);F.manualUrl='';F.manualNote='';render();toast('External funnel / lead magnet evidence saved.')
  };

  // Funnel presence filter appears alongside the existing prospect filters.
  if(typeof filterHtml==='function'){
    const fiBaseFilterHtml=filterHtml;filterHtml=function(){let h=fiBaseFilterHtml();const f=state.filters.funnelPresence||'ALL',sel=(v)=>f===v?'selected':'';const control=`<select title="Funnel / lead magnet presence" onchange="state.filters.funnelPresence=this.value;render()"><option value="ALL" ${sel('ALL')}>Any funnel presence</option><option value="NO_FUNNEL_FOUND" ${sel('NO_FUNNEL_FOUND')}>No funnel found · checked</option><option value="BASIC_FORM_ONLY" ${sel('BASIC_FORM_ONLY')}>Basic form only</option><option value="LEAD_MAGNET_FOUND" ${sel('LEAD_MAGNET_FOUND')}>Lead magnet found</option><option value="FUNNEL_FOUND" ${sel('FUNNEL_FOUND')}>Funnel found</option><option value="FUNNEL_AND_LEAD_MAGNET" ${sel('FUNNEL_AND_LEAD_MAGNET')}>Funnel + lead magnet</option><option value="UNCHECKED" ${sel('UNCHECKED')}>Funnel unchecked</option></select>`;return h.replace(/<\/div>\s*$/,control+'</div>')};
  }
  if(typeof visible==='function'){
    const fiBaseVisible=visible;visible=function(){const a=fiBaseVisible(),f=state.filters.funnelPresence||'ALL';return f==='ALL'?a:a.filter(l=>fiStatus(l)===f)};
  }

  function fiEvidence(x){const a=x?.evidence||[];if(!a.length)return'<div class="sub">No funnel evidence recorded.</div>';return a.slice(0,12).map(ev=>`<div class="notice" style="margin:6px 0"><b>${fiEsc(ev.label||ev.type)}</b><div class="sub">${fiEsc(ev.detail||'')}</div>${ev.url?`<a href="${fiEsc(ev.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);word-break:break-all">${fiEsc(ev.url)}</a>`:''}</div>`).join('')}
  function fiPanel(l){const x=fiIntel(l),st=fiStatus(l),m=x?.maturityScore,o=x?.funnelOpportunitySignal;return `<div class="section"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><b>Funnel / Lead Magnet Intelligence</b><div class="sub">Checks the business website, selected same-site pages, sitemap conversion pages, and linked public funnel/booking/form tools.</div></div><span class="tag ${fiClass(st)}">${fiEsc(fiLabel(l))}</span></div>
    ${x?`<div class="grid2" style="margin-top:12px"><div class="notice"><b>Funnel maturity</b><div style="font-size:20px;font-weight:900;margin-top:4px">${m==null?'—':Math.round(m)+'/100'}</div><div class="sub">${m==null?'Unchecked':fiMaturityMeaning(m)}</div></div><div class="notice"><b>Funnel Design opportunity signal</b><div style="font-size:20px;font-weight:900;margin-top:4px">${o==null?'—':Math.round(o)+'/100'}</div><div class="sub">${o==null?'Unchecked':fiOppMeaning(o)}</div></div></div><div class="kv"><span>Pages checked</span><span>${Number(x.pagesChecked||0)}</span><span>Platforms</span><span>${fiEsc((x.platforms||[]).join(', ')||'None detected')}</span><span>Checked</span><span>${fiEsc(x.checkedAt?new Date(x.checkedAt).toLocaleString():'Unknown')}</span></div><div class="notice"><b>Scope:</b> ${fiEsc(x.checkedScope||'Checked sources only. This does not prove the entire public internet.')}</div><details><summary style="cursor:pointer;font-weight:800">Evidence (${(x.evidence||[]).length})</summary><div style="margin-top:8px">${fiEvidence(x)}</div></details>`:'<div class="notice" style="margin-top:12px">Not checked yet. Unknown does not count as a funnel weakness.</div>'}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn primary" onclick="fiScan()" ${F.running&&F.leadId===l.id?'disabled':''}>${F.running&&F.leadId===l.id?'Scanning Website…':'Scan Funnel Presence'}</button>${l.website?`<a class="btn" href="${fiEsc(fiUrl(l.website))}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Open Website</a>`:''}</div>
    <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:800">Found an external funnel yourself? Add it</summary><div class="grid2" style="margin-top:10px"><label class="field"><span>Evidence type</span><select onchange="fiManualType(this.value)"><option value="FUNNEL">Funnel / booking / quote page</option><option value="LEAD_MAGNET">Lead magnet / free offer</option></select></label><label class="field"><span>Public URL</span><input placeholder="https://..." oninput="fiManualUrl(this.value)"></label></div><label class="field" style="display:block;margin-top:8px"><span>Research note</span><input placeholder="Example: Google Ads landing page / free guide / Calendly booking page" oninput="fiManualNote(this.value)"></label><button class="btn" style="margin-top:8px" onclick="fiSaveManual()">Save External Evidence</button><div class="sub" style="margin-top:7px">Manual evidence is useful for funnels found through ads, social profiles, Google links, or other public pages that are not linked from the main website. Saving it will also save the lead to the CRM if needed.</div></details></div>`}
  if(typeof drawer==='function'){
    const fiBaseDrawer=drawer;drawer=function(){let h=fiBaseDrawer(),l=state.selected;if(!l)return h;const panel=fiPanel(l),marker='<div class="section"><b>Opportunity Score Breakdown</b>';return h.includes(marker)?h.replace(marker,panel+marker):h.replace('<div class="section"><b>CRM</b>',panel+'<div class="section"><b>CRM</b>')};
  }

  // Add a compact funnel badge to visible search rows without altering the table's scoring math.
  if(typeof render==='function'){
    const fiBaseRender=render;render=function(){fiBaseRender();if(state.view!=='search')return;try{const panels=[...document.querySelectorAll('.panel')],p=panels.find(x=>x.querySelector('.eyebrow')?.textContent?.includes('MARKET RESULTS'));if(!p)return;const rows=[...p.querySelectorAll('tbody tr')],leads=visible();rows.forEach((row,i)=>{const l=leads[i];if(!l)return;const cell=row.children?.[2];if(!cell||cell.querySelector('.fi-row-tag'))return;const span=document.createElement('div');span.className='fi-row-tag sub';span.style.marginTop='5px';span.innerHTML=`Funnel: <span class="tag ${fiClass(fiStatus(l))}">${fiEsc(fiLabel(l))}</span>`;cell.appendChild(span)})}catch{}};
  }
  render();
})();