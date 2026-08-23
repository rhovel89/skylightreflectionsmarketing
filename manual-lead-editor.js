// Manual Lead Editor: fill/correct contact and profile data found during research.
(function(){
  if(typeof state==='undefined') return;
  state.manualLeadEditor=state.manualLeadEditor||{open:false,leadId:null,draft:null,loading:false,saving:false,rescanning:false};
  const M=state.manualLeadEditor;
  const socialFields=['facebook','instagram','linkedin','tiktok','youtube','x'];
  function meEsc(v){return typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function meUrl(v){let s=String(v||'').trim();if(!s)return'';if(!/^https?:\/\//i.test(s))s='https://'+s;try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:''}catch{return''}}
  function meEmail(v){return String(v||'').trim().toLowerCase()}
  function mePhone(v){return String(v||'').trim()}
  function meSocials(l){return{facebook:l?.socials?.facebook||'',instagram:l?.socials?.instagram||'',linkedin:l?.socials?.linkedin||l?.linkedin||'',tiktok:l?.socials?.tiktok||'',youtube:l?.socials?.youtube||'',x:l?.socials?.x||l?.x||''}}
  function meDraft(l,row={}){return{
    phone:row.phone??l?.phone??'',email:row.business_email??l?.email??'',website:row.website??l?.website??'',decisionMaker:row.decision_maker_name??l?.decisionMaker??'',title:row.decision_maker_title??l?.title??'',address:row.address??l?.address??'',city:row.city??l?.city??'',state:row.state??l?.state??'',sourceNote:'Website / contact page',
    socials:{facebook:row.facebook_url??meSocials(l).facebook,instagram:row.instagram_url??meSocials(l).instagram,linkedin:row.linkedin_url??meSocials(l).linkedin,tiktok:row.tiktok_url??meSocials(l).tiktok,youtube:row.youtube_url??meSocials(l).youtube,x:row.x_url??meSocials(l).x}
  }}
  window.meSet=function(k,v){if(!M.draft)return;if(k.startsWith('socials.'))M.draft.socials[k.split('.')[1]]=v;else M.draft[k]=v};
  window.meCancel=function(){M.open=false;M.leadId=null;M.draft=null;render()};
  window.meStart=async function(){
    const l=state.selected;if(!l)return;M.open=true;M.leadId=l.id;M.loading=true;M.draft=meDraft(l);render();
    try{const s=findSaved(l);if(s&&isUuid(s.id)){const {data,error}=await sb.from('leads').select('phone,business_email,website,decision_maker_name,decision_maker_title,address,city,state,facebook_url,instagram_url,linkedin_url,tiktok_url,youtube_url,x_url').eq('id',s.id).single();if(!error&&data)M.draft=meDraft({...l,...s},data)}}catch(e){console.warn('Manual editor load',e)}finally{M.loading=false;render()}
  };
  async function meRebuildIdentifiers(l){if(!cloud?.session||!isUuid(l?.id))return;try{await sb.from('lead_identifiers').delete().eq('user_id',cloud.session.user.id).eq('lead_id',l.id);if(typeof syncIdentifiers==='function')await syncIdentifiers(l)}catch(e){console.warn('Identifier rebuild',e)}}
  function meApplyDraft(l,d){const socials={};for(const k of socialFields)socials[k]=meUrl(d.socials?.[k]);const n={...l,phone:mePhone(d.phone),email:meEmail(d.email),website:meUrl(d.website),decisionMaker:String(d.decisionMaker||'').trim(),title:String(d.title||'').trim(),address:String(d.address||'').trim(),city:String(d.city||'').trim(),state:String(d.state||'').trim(),socials};try{Object.assign(n,score(n));if(typeof hcvSyncLead==='function')hcvSyncLead(n)}catch{}return n}
  async function meSaveToCloud(original,n,sourceNote){
    let s=findSaved(original)||findSaved(n);
    if(!s){await saveLead(n,true);s=findSaved(n)}
    if(!s||!isUuid(s.id))throw new Error('Lead could not be saved to CRM.');
    const socials=meSocials(n),payload={
      phone:n.phone||null,normalized_phone:n.phone?n.phone.replace(/\D/g,''):null,business_email:n.email||null,professional_email:Boolean(n.email),website:n.website||null,normalized_domain:n.website?domain(n.website):null,decision_maker_name:n.decisionMaker||null,decision_maker_title:n.title||null,address:n.address||null,normalized_address:n.address?norm(n.address):null,city:n.city||null,state:n.state||null,
      facebook_url:socials.facebook||null,instagram_url:socials.instagram||null,linkedin_url:socials.linkedin||null,tiktok_url:socials.tiktok||null,youtube_url:socials.youtube||null,x_url:socials.x||null,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await sb.from('leads').update(payload).eq('id',s.id).eq('user_id',cloud.session.user.id).select().single();if(error)throw error;
    let saved={...n,...(typeof dbToLead==='function'?dbToLead(data):{}),id:s.id,socials};try{Object.assign(saved,score(saved));if(typeof hcvSyncLead==='function')hcvSyncLead(saved)}catch{}
    state.saved=state.saved.map(x=>x.id===s.id?saved:x);
    state.results=state.results.map(x=>(x.id===original.id||same(x,original))?{...x,...saved}:x);
    state.selected=saved;await meRebuildIdentifiers(saved);
    if(typeof log==='function')log(saved,'manual_contact_update',`Manual lead information updated${sourceNote?` · source: ${sourceNote}`:''}`);
    persist();return saved;
  }
  window.meSave=async function(){
    if(M.saving||!state.selected||!M.draft)return;const d=M.draft;if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(meEmail(d.email)))return toast('That email address does not look valid.');if(d.website&&!meUrl(d.website))return toast('That website URL does not look valid.');
    M.saving=true;render();try{const original=state.selected,n=meApplyDraft(original,d);await meSaveToCloud(original,n,String(d.sourceNote||'').trim());M.open=false;M.draft=null;toast('Lead information saved to CRM.')}catch(e){toast('Could not save lead information: '+(e?.message||'Unknown error'))}finally{M.saving=false;render()}
  };
  window.meRescanWebsite=async function(){
    if(M.rescanning||!state.selected)return;const l=state.selected,website=meUrl(M.draft?.website||l.website);if(!website)return toast('Add the business website first, then re-scan it.');M.rescanning=true;render();
    try{const {data,error}=await sb.functions.invoke('free-prospect-enrich',{body:{leads:[{id:l.id,name:l.name,website}]}});if(error)throw error;if(data?.error)throw new Error(data.error);const r=(data?.results||[])[0];if(!r)throw new Error('No website enrichment result was returned.');let n;if(typeof afeApply==='function')n=afeApply({...l,website},r);else{n={...l,website:r.finalUrl||website,phone:l.phone||(r.contacts?.phones?.[0]||''),email:l.email||(r.contacts?.emails?.[0]||''),socials:{...meSocials(l),...(r.socials||{})},freeContactChecked:true,autoEnriched:true};try{Object.assign(n,score(n))}catch{}}
      let s=findSaved(l);if(!s){await saveLead(n,true);s=findSaved(n)}else if(typeof afePersistSaved==='function'){await afePersistSaved(l,n);s=findSaved(n)||findSaved(l)}else await saveLead(n,true);
      const current=s||n;state.results=state.results.map(x=>(x.id===l.id||same(x,l))?{...x,...n,...current,socials:{...meSocials(n),...meSocials(current)}}:x);state.selected={...n,...current,socials:{...meSocials(n),...meSocials(current)}};M.draft=meDraft(state.selected);if(typeof log==='function'&&isUuid(state.selected.id))log(state.selected,'website_contact_rescan','Website re-scanned for public phone, email, social and contact information');persist();toast('Website contact re-scan completed.')}catch(e){toast('Website re-scan failed: '+(e?.message||'Unknown error'))}finally{M.rescanning=false;render()}
  };
  function meField(label,key,value,placeholder=''){return `<label class="field"><span>${meEsc(label)}</span><input value="${meEsc(value||'')}" placeholder="${meEsc(placeholder)}" oninput="meSet('${key}',this.value)"></label>`}
  function mePanel(l){
    if(!M.open||M.leadId!==l.id)return `<div class="section"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>Lead Information Editor</b><div class="sub">Found a phone, email, owner or social link on the website? Add it here and save it permanently to the CRM.</div></div><button class="btn primary" onclick="meStart()">Edit Lead Info</button></div>${l.website?`<button class="btn" style="margin-top:10px" onclick="meRescanWebsite()">Re-scan Website for Contact Info</button>`:''}</div>`;
    if(M.loading)return `<div class="section"><b>Lead Information Editor</b><div class="empty" style="padding:22px">Loading saved contact information…</div></div>`;
    const d=M.draft||meDraft(l);return `<div class="section"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>Edit Lead Information</b><div class="sub">Manual values are treated as researched contact data. Unknown fields can stay blank.</div></div><span class="tag good">MANUAL RESEARCH</span></div>
      <div class="grid2" style="margin-top:12px">${meField('Phone','phone',d.phone,'Business phone')}${meField('Email','email',d.email,'name@business.com')}${meField('Website','website',d.website,'https://business.com')}${meField('Decision maker / owner','decisionMaker',d.decisionMaker,'Owner or contact name')}${meField('Decision-maker title','title',d.title,'Owner, Partner, Manager…')}${meField('Street address','address',d.address,'Business address')}${meField('City','city',d.city,'City')}${meField('State','state',d.state,'IL')}</div>
      <div style="margin-top:14px"><b>Social Profiles</b><div class="grid2" style="margin-top:8px">${meField('Facebook','socials.facebook',d.socials?.facebook,'facebook.com/...')}${meField('Instagram','socials.instagram',d.socials?.instagram,'instagram.com/...')}${meField('LinkedIn','socials.linkedin',d.socials?.linkedin,'linkedin.com/company/...')}${meField('TikTok','socials.tiktok',d.socials?.tiktok,'tiktok.com/@...')}${meField('YouTube','socials.youtube',d.socials?.youtube,'youtube.com/@...')}${meField('X / Twitter','socials.x',d.socials?.x,'x.com/...')}</div></div>
      <label class="field" style="display:block;margin-top:12px"><span>Where did you verify/find this information?</span><input value="${meEsc(d.sourceNote||'')}" placeholder="Example: Website contact page" oninput="meSet('sourceNote',this.value)"></label>
      <div class="notice" style="margin-top:12px;margin-bottom:0"><b>Tip:</b> If the lead has a website, try the free website re-scan first. It can pick up public phone numbers, emails and social links from the site. You can then manually correct anything it misses.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn primary" onclick="meSave()" ${M.saving?'disabled':''}>${M.saving?'Saving…':'Save Lead Information'}</button><button class="btn" onclick="meCancel()">Cancel</button><button class="btn" onclick="meRescanWebsite()" ${M.rescanning?'disabled':''}>${M.rescanning?'Scanning Website…':'Re-scan Website'}</button></div></div>`
  }
  const meDrawerBase=drawer;drawer=function(){let h=meDrawerBase();const l=state.selected;if(!l)return h;const panel=mePanel(l),marker='<div class="section"><b>Google / Maps</b>';return h.includes(marker)?h.replace(marker,panel+marker):h.replace('</div></div>',panel+'</div></div>')};
  render();
})();