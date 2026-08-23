// PRIME scoring correction: marketing need is the gate; reachability/age are secondary qualifiers.
function pnfNeedScore(l){
  let n=0,reasons=[];const add=(name,pts)=>{n+=pts;reasons.push([name,pts,'need'])};
  const fresh=bpFreshnessDays(l),socialCount=bpSocialCount(l);
  if(!l.website)add('NEED · No website',60);
  else if(l.auditChecked===true){
    const w=Number(l.webScore);
    if(Number.isFinite(w)){
      if(w<40)add('NEED · Very poor website',45);
      else if(w<55)add('NEED · Weak website',35);
      else if(w<65)add('NEED · Below-average website',25);
      else if(w<75)add('NEED · Website has meaningful room to improve',12);
    }
    if(l.analytics===false)add('NEED · Analytics not detected',6);
    if(l.metaPixel===false)add('NEED · Meta Pixel not detected',5);
    if(l.adsTracking===false)add('NEED · Google Ads tracking not detected',6);
    if(l.schema===false)add('NEED · Schema not detected',8);
    if(l.ctaStrong===false)add('NEED · Weak calls to action / funnel',10);
  }
  if(fresh!=null){
    if(fresh>730)add('NEED · Website appears 2+ years stale',18);
    else if(fresh>365)add('NEED · Website appears 1+ year stale',12);
    else if(fresh>180)add('NEED · Website appears 6+ months stale',6);
  }
  if(l.freeContactChecked===true||l.socialChecked===true){
    if(socialCount===0)add('NEED · No social profiles found',8);
    else if(socialCount===1)add('NEED · Very limited social presence',4);
  }
  const yt=l?.socialActivityData?.youtube;
  if(yt?.checked&&Number.isFinite(+yt.daysSinceActivity)){
    if(+yt.daysSinceActivity>365)add('NEED · YouTube inactive 1+ year',4);
    else if(+yt.daysSinceActivity>180)add('NEED · YouTube inactive 6+ months',2);
  }
  if(l.gbpClaimed===false)add('NEED · Google Business Profile verified unclaimed',10);
  if(l.mapRankChecked===true){
    if(l.mapRank==null)add('NEED · No verified Maps ranking found',10);
    else if(Number(l.mapRank)>3)add('NEED · Outside verified top-3 Map Pack',7);
  }
  if(Number.isFinite(+l.reviews)&&+l.reviews>0&&+l.reviews<20)add('NEED · Low review count',6);
  if(Number.isFinite(+l.rating)&&+l.rating>0&&+l.rating<4)add('NEED · Rating below 4.0',7);
  return{score:Math.min(100,n),reasons};
}

function pnfFitScore(l){
  let n=0,reasons=[];const add=(name,pts)=>{n+=pts;reasons.push([name,pts,'fit'])};
  const y=ageYears(l),socialCount=bpSocialCount(l);
  if(y!=null){
    if(y>=3&&y<=30)add('FIT · Established 3–30 years',8);
    else if(y>30)add('FIT · Long-established business',6);
    else if(y>=1)add('FIT · Operating history identified',3);
  }
  if(l.phone)add('ACCESS · Phone available',5);
  if(l.email)add('ACCESS · Email available',4);
  if(l.decisionMaker)add('ACCESS · Decision maker identified',4);
  if(socialCount>0)add('ACCESS · Social contact path available',2);
  return{score:Math.min(23,n),reasons};
}

lowHangingScore=function(l){
  const need=pnfNeedScore(l),fit=pnfFitScore(l),reachable=reachableLead(l);
  let s=Math.min(100,need.score+fit.score);
  // Hard gates keep healthy/easy-to-contact businesses out of PRIME/STRONG.
  if(need.score<20)s=Math.min(s,44);
  else if(need.score<35)s=Math.min(s,59);
  else if(need.score<50)s=Math.min(s,74);
  // PRIME means strong verified need + reachable. A high website/contact score alone cannot qualify.
  let grade='LOW';
  if(s>=75&&need.score>=50&&reachable)grade='PRIME';
  else if(s>=60&&need.score>=35&&reachable)grade='STRONG';
  else if(s>=45&&need.score>=20)grade='POSSIBLE';
  return{score:s,reasons:[...need.reasons,...fit.reasons],grade,needScore:need.score,fitScore:fit.score,reachable};
};

applyLowHanging=function(l){const x=lowHangingScore(l);l.lowHangingScore=x.score;l.lowHangingReasons=x.reasons;l.lowHangingGrade=x.grade;l.marketingNeedScore=x.needScore;l.prospectFitScore=x.fitScore;return l};

isLowFruit=function(l){const x=lowHangingScore(l);return (x.grade==='PRIME'||x.grade==='STRONG')&&x.reachable};

// Priority filter follows the actual gated grade, not numeric score alone.
psfPriorityPass=function(l){const g=lowHangingScore(l).grade,b=state.filters.priorityBand;return b==='ALL'||g===b};

// PRIME quick-win and bulk-save use the corrected gated grade.
const pnfQwMatchBase=qwMatch;
qwMatch=function(l,type){if(type==='PRIME')return lowHangingScore(l).grade==='PRIME';return pnfQwMatchBase(l,type)};
saveTopPrime=async function(){const leads=[...state.results].map(applyLowHanging).filter(l=>lowHangingScore(l).grade==='PRIME').sort((a,b)=>lowHangingScore(b).score-lowHangingScore(a).score).slice(0,10);if(!leads.length)return toast('No verified PRIME prospects are available yet. Try STRONG, run enrichment, or search another market.');let added=0;for(const l of leads){if(!findSaved(l)){await saveLead(l,true);added++}}render();toast(added?`Saved ${added} verified PRIME prospect${added===1?'':'s'} to the CRM.`:'Top verified PRIME prospects are already saved.')};

// Show the distinction clearly in the drawer.
const pnfDrawerBase=drawer;
drawer=function(){let h=pnfDrawerBase();if(!state.selected)return h;const x=lowHangingScore(state.selected);const marker='<span>Low-Hanging Score</span>';
  if(h.includes(marker)&&!h.includes('Verified Marketing Need'))h=h.replace(marker,`<span>Verified Marketing Need</span><span><b>${x.needScore}/100</b> · ${x.needScore>=50?'Strong need':x.needScore>=35?'Meaningful need':x.needScore>=20?'Moderate need':'Limited verified need'}</span><span>Prospect Fit / Access</span><span><b>${x.fitScore}/23</b> · secondary qualifier</span>${marker}`);
  return h;
};

// Make score meanings reflect the corrected gating.
smLowMeaning=function(n){n=Number(n)||0;return n>=75?'Contact First · Strong Verified Need':n>=60?'Good Prospect · Meaningful Verified Need':n>=45?'Worth Reviewing · Moderate Need':'Lower Priority / Limited Verified Need'};
smcLowMeaning=smLowMeaning;

const pnfRenderBase=render;
render=function(){pnfRenderBase();const conn=document.querySelector('.conn');if(conn){let row=document.getElementById('primeNeedStatus');if(!row){row=document.createElement('div');row.className='prov';row.id='primeNeedStatus';conn.appendChild(row)}row.innerHTML='<span>PRIME Logic</span><b style="color:var(--green)">NEED-FIRST · VERIFIED</b>'}};
render();
