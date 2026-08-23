// Google Business Profile ownership + verification workflow for SEO Audit Lab.
// Lead-generation mode never fabricates claimed/verified status. Exact GBP verification
// is only available for an authorized merchant relationship; manual confirmation is supported.
(function(){
  if(typeof state==='undefined'||!state.seoLab)return;
  const defaults={gbpClaim:'UNKNOWN',gbpVerification:'UNKNOWN',gbpStatusSource:'',gbpStatusNotes:''};
  state.seoLab.form={...defaults,...(state.seoLab.form||{})};

  function claimLabel(v){return v==='CLAIMED'?'Claimed · Confirmed':v==='UNCLAIMED'?'Unclaimed · Confirmed':'Unknown · Not confirmed'}
  function verifyLabel(v){return v==='VERIFIED'?'Verified · Confirmed':v==='NEEDS_VERIFICATION'?'Needs Verification · Confirmed':v==='NEEDS_REVERIFICATION'?'Needs Reverification · Confirmed':'Unchecked · Not confirmed'}
  function sourceLabel(v){return v==='MANUAL'?'Manual Google profile inspection':v==='CLIENT'?'Confirmed by business/client':v==='AUTHORIZED'?'Authorized Google Business Profile access':'No confirmation source recorded'}
  function safeGoogleUrl(v){
    try{const u=new URL(String(v||'').trim());const h=u.hostname.toLowerCase();if(u.protocol!=='https:')return'';if(h==='maps.app.goo.gl'||h==='goo.gl'||h==='google.com'||h==='www.google.com'||h.endsWith('.google.com')||/^www\.google\.[a-z.]+$/.test(h)||/^google\.[a-z.]+$/.test(h))return u.href}catch{}return'';
  }
  function currentStatus(){const f=state.seoLab.form||{};return{claimStatus:f.gbpClaim||'UNKNOWN',verificationStatus:f.gbpVerification||'UNKNOWN',source:f.gbpStatusSource||'',notes:String(f.gbpStatusNotes||'').trim(),confirmedAt:(f.gbpClaim&&f.gbpClaim!=='UNKNOWN'||f.gbpVerification&&f.gbpVerification!=='UNKNOWN')?new Date().toISOString():null,mode:f.gbpStatusSource==='AUTHORIZED'?'authorized-client':'lead-audit'}}
  function resultStatus(r){return r?.googleBusiness?.ownershipVerification||currentStatus()}
  function applyStatus(r){if(!r)return r;const s=currentStatus();r.googleBusiness={...(r.googleBusiness||{}),ownershipVerification:s,claimStatus:claimLabel(s.claimStatus),verificationStatus:verifyLabel(s.verificationStatus)};return r}
  function salesAngle(s){
    if(s.claimStatus==='UNCLAIMED')return 'High-priority local SEO opening: help the business claim the profile, complete verification, then optimize categories, services, reviews, citations and conversion tracking.';
    if(s.verificationStatus==='NEEDS_VERIFICATION'||s.verificationStatus==='NEEDS_REVERIFICATION')return 'High-priority GBP setup issue: verification/reverification should be completed before relying on the profile as a stable local-search asset.';
    if(s.verificationStatus==='VERIFIED')return 'The profile is confirmed verified. Sell optimization—not claiming: categories, services, reviews, photos, posts, citations, landing pages, tracking and local authority.';
    if(s.claimStatus==='CLAIMED')return 'The profile is confirmed claimed, but verification was not independently confirmed. Focus the sales conversation on profile quality and local SEO while leaving verification marked unchecked.';
    return 'Ownership and verification are not confirmed. Do not present either as a weakness; use the profile URL for manual review and sell only verified local-SEO gaps.';
  }
  async function persistCurrent(){
    if(!state.seoLab.result||!cloud?.session)return;
    applyStatus(state.seoLab.result);
    const hist=state.seoLab.history||[];
    const r=state.seoLab.result;
    const hit=hist.find(x=>x.final_url===r.finalUrl||x.website_url===r.website||x.website_url===r.finalUrl);
    if(hit?.id){const {error}=await sb.from('seo_audits').update({result:r,google_business_url:r.googleBusiness?.url||state.seoLab.form.gbp||null}).eq('id',hit.id).eq('user_id',cloud.session.user.id);if(error)console.warn('GBP status save',error.message)}
  }

  window.gbpSetClaim=function(v){state.seoLab.form.gbpClaim=v||'UNKNOWN';render()};
  window.gbpSetVerification=function(v){state.seoLab.form.gbpVerification=v||'UNKNOWN';render()};
  window.gbpSetStatusSource=function(v){state.seoLab.form.gbpStatusSource=v||'';render()};
  window.gbpSetStatusNotes=function(v){state.seoLab.form.gbpStatusNotes=v||''};
  window.gbpSaveStatus=async function(){if(state.seoLab.result)applyStatus(state.seoLab.result);await persistCurrent();render();toast('Google profile ownership / verification status saved with this SEO audit.')};

  function statusInputPanel(){const f=state.seoLab.form||{},url=safeGoogleUrl(f.gbp);return `<div class=panel style="margin-bottom:14px"><div class=head><div><div class=eyebrow>GOOGLE PROFILE OWNERSHIP & VERIFICATION</div><h2>Claimed / verified status</h2><div class=sub>Lead Mode does not guess Google ownership or verification. Confirm it manually when you inspect the profile, or use authorized client access later for an exact Google-provided state.</div></div><span class=tag>${url?'PROFILE URL READY':'NO PROFILE URL'}</span></div><div style="padding:14px"><div class=grid2><label class=field><span>Claim status</span><select onchange="gbpSetClaim(this.value)"><option value="UNKNOWN" ${f.gbpClaim==='UNKNOWN'?'selected':''}>Unknown / not confirmed</option><option value="CLAIMED" ${f.gbpClaim==='CLAIMED'?'selected':''}>Claimed — manually confirmed</option><option value="UNCLAIMED" ${f.gbpClaim==='UNCLAIMED'?'selected':''}>Unclaimed — manually confirmed</option></select></label><label class=field><span>Verification status</span><select onchange="gbpSetVerification(this.value)"><option value="UNKNOWN" ${f.gbpVerification==='UNKNOWN'?'selected':''}>Unchecked / not confirmed</option><option value="VERIFIED" ${f.gbpVerification==='VERIFIED'?'selected':''}>Verified — confirmed</option><option value="NEEDS_VERIFICATION" ${f.gbpVerification==='NEEDS_VERIFICATION'?'selected':''}>Needs verification — confirmed</option><option value="NEEDS_REVERIFICATION" ${f.gbpVerification==='NEEDS_REVERIFICATION'?'selected':''}>Needs reverification — confirmed</option></select></label><label class=field><span>How was this confirmed?</span><select onchange="gbpSetStatusSource(this.value)"><option value="" ${!f.gbpStatusSource?'selected':''}>Not confirmed</option><option value="MANUAL" ${f.gbpStatusSource==='MANUAL'?'selected':''}>Manual Google profile inspection</option><option value="CLIENT" ${f.gbpStatusSource==='CLIENT'?'selected':''}>Business/client confirmed it</option><option value="AUTHORIZED" ${f.gbpStatusSource==='AUTHORIZED'?'selected':''}>Authorized GBP account access</option></select></label><label class=field><span>Confirmation notes</span><input value="${esc(f.gbpStatusNotes||'')}" placeholder="Example: owner confirmed profile is verified" oninput="gbpSetStatusNotes(this.value)"></label></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${url?`<a class=btn href="${esc(url)}" target=_blank rel="noopener noreferrer" style="text-decoration:none">Open Google Profile to Confirm</a>`:''}<button class="btn primary" onclick="gbpSaveStatus()" ${state.seoLab.result?'':'disabled'}>Save Status With Audit</button></div><div class=notice style="margin-top:12px"><b>Automatic lead-mode limitation:</b> Google Places does not expose a claimed/verified field, and Google Business Profile ownership/verification endpoints are not permitted for arbitrary lead-generation lookups. Unknown therefore stays unknown until legitimately confirmed.</div></div></div>`}

  const baseView=seoLabView;
  seoLabView=function(){let h=baseView();const p=statusInputPanel(),ix=h.indexOf('onclick="seoRun()"');if(ix>=0){const end=h.indexOf('</button></div></div>',ix);if(end>=0)return h.slice(0,end+20)+p+h.slice(end+20)}return p+h};

  const baseResult=seoResultHtml;
  seoResultHtml=function(r){if(!r)return baseResult(r);applyStatus(r);let h=baseResult(r);const s=resultStatus(r),url=safeGoogleUrl(r?.googleBusiness?.url||state.seoLab.form.gbp);const panel=`<div class=panel style="margin-bottom:14px"><div class=head><div><div class=eyebrow>GOOGLE PROFILE STATUS</div><h2>Ownership & verification evidence</h2></div><span class="tag ${s.verificationStatus==='VERIFIED'?'good':s.claimStatus==='UNCLAIMED'||s.verificationStatus==='NEEDS_VERIFICATION'||s.verificationStatus==='NEEDS_REVERIFICATION'?'bad':''}">${esc(verifyLabel(s.verificationStatus))}</span></div><div style="padding:14px"><div class=stats style="margin:0 0 14px"><div class=stat><span>Google profile</span><b>${url?'Found / Provided':'Not Provided'}</b><div class=sub>${url?'Ready for review':'Paste a Google Maps/Profile URL'}</div></div><div class=stat><span>Claim status</span><b>${esc(claimLabel(s.claimStatus))}</b><div class=sub>${esc(sourceLabel(s.source))}</div></div><div class=stat><span>Verification</span><b>${esc(verifyLabel(s.verificationStatus))}</b><div class=sub>${s.mode==='authorized-client'?'Authorized-client evidence':'Lead-audit evidence'}</div></div></div><div class=notice><b>Sales interpretation:</b> ${esc(salesAngle(s))}</div>${s.notes?`<div class=notice><b>Confirmation notes:</b> ${esc(s.notes)}</div>`:''}${url?`<a class=btn href="${esc(url)}" target=_blank rel="noopener noreferrer" style="display:inline-block;text-decoration:none;margin-top:4px">Open Google Profile</a>`:''}<div class=sub style="margin-top:10px">Exact Google verification can be read from Google Business Profile only for an authorized merchant relationship. Unchecked status is never scored as a failure.</div></div></div>`;const marker='<div class=panel><div class=head><div><div class=eyebrow>SERVICE PACKAGE</div>';return h.includes(marker)?h.replace(marker,panel+marker):h+panel};

  const basePitch=seoPitch;
  seoPitch=function(r){const s=resultStatus(r);return `${basePitch(r)}\n\nGoogle Business Profile\nClaim status: ${claimLabel(s.claimStatus)}\nVerification: ${verifyLabel(s.verificationStatus)}\nConfirmation source: ${sourceLabel(s.source)}\nSales interpretation: ${salesAngle(s)}`};

  const baseSell=seoSellPlan;
  seoSellPlan=function(r){const a=baseSell(r),s=resultStatus(r);if(s.claimStatus==='UNCLAIMED'||s.verificationStatus==='NEEDS_VERIFICATION'||s.verificationStatus==='NEEDS_REVERIFICATION')a.unshift('Google Business Profile claim / verification setup');return[...new Set(a)]};

  const baseRun=seoRun;
  seoRun=async function(){await baseRun();if(state.seoLab.result){applyStatus(state.seoLab.result);await persistCurrent();render()}};

  const baseOpen=seoOpenHistory;
  seoOpenHistory=function(id){baseOpen(id);const s=state.seoLab.result?.googleBusiness?.ownershipVerification;state.seoLab.form={...defaults,...state.seoLab.form,...(s?{gbpClaim:s.claimStatus||'UNKNOWN',gbpVerification:s.verificationStatus||'UNKNOWN',gbpStatusSource:s.source||'',gbpStatusNotes:s.notes||''}:{})};render()};

  const baseLeadToLab=seoLeadToLab;
  seoLeadToLab=function(l){baseLeadToLab(l);state.seoLab.form={...defaults,...state.seoLab.form};render()};

  render();
})();