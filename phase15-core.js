state.p15={...(state.p15||{}),health:null,healthRunning:false,analytics:[],analyticsLoaded:false,analyticsLoading:false};

const p15Clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
const p15Avg=a=>a.length?a.reduce((s,n)=>s+(Number(n)||0),0)/a.length:null;
const p15Pct=(n,d)=>d?Math.round(n/d*100):0;
const p15SocialCount=l=>Object.values(l?.socials||{}).filter(Boolean).length;
const p15AuditData=l=>l?.websiteAuditData||l?.auditData||l?.website_audit||{};

function p15ServiceScores(l){
  const wa=p15AuditData(l),days=bpFreshnessDays(l),scores={};
  if(!l.website){scores.website={score:100,confidence:'high',why:['No website found']};}
  else if(l.auditChecked===true){
    let n=Math.max(0,100-(Number(l.webScore)||0));const why=[];
    if(Number(l.webScore)<60)why.push(`Website score ${Math.round(Number(l.webScore)||0)}/100`);
    if(days!=null&&days>365){n+=days>730?18:10;why.push(days>730?'Website appears 2+ years stale':'Website appears 1+ year stale');}
    if(l.ctaStrong===false){n+=8;why.push('Weak calls to action');}
    scores.website={score:p15Clamp(n),confidence:'high',why};
  }else scores.website={score:null,confidence:'unchecked',why:['Website audit needed']};

  if(l.auditChecked===true){
    let n=0,why=[];const title=wa.title??wa.page_title,meta=wa.meta_description??wa.metaDescription,h1=wa.h1_count??wa.h1Count,viewport=wa.has_viewport??wa.hasViewport;
    if(l.schema===false){n+=30;why.push('Schema not detected');}
    if(title===''){n+=18;why.push('Page title missing');}
    if(meta===''){n+=18;why.push('Meta description missing');}
    if(h1!=null&&Number(h1)!==1){n+=17;why.push('H1 structure needs work');}
    if(viewport===false){n+=17;why.push('Mobile viewport missing');}
    scores.seo={score:p15Clamp(n),confidence:'high',why};
  }else scores.seo={score:null,confidence:'unchecked',why:['Website audit needed']};

  const socialKnown=l.freeContactChecked===true||l.socialChecked===true||p15SocialCount(l)>0;
  if(socialKnown){
    const c=p15SocialCount(l);let n=c===0?100:c===1?80:c===2?60:c===3?40:c===4?25:10,why=[];
    if(c===0)why.push('No social profiles found');else if(c<=2)why.push(`Only ${c} social profile${c===1?'':'s'} found`);
    const yt=l?.socialActivityData?.youtube;if(yt?.checked&&Number.isFinite(+yt.daysSinceActivity)&&+yt.daysSinceActivity>180){n+=+yt.daysSinceActivity>365?12:7;why.push('YouTube activity is stale');}
    scores.social={score:p15Clamp(n),confidence:l.freeContactChecked===true?'high':'partial',why};
  }else scores.social={score:null,confidence:'unchecked',why:['Social discovery needed']};

  const ppcKnown=[l.analytics,l.metaPixel,l.adsTracking].some(v=>v===true||v===false);
  if(ppcKnown){let n=0,why=[];if(l.analytics===false){n+=30;why.push('Analytics not detected');}if(l.metaPixel===false){n+=30;why.push('Meta Pixel not detected');}if(l.adsTracking===false){n+=40;why.push('Google Ads conversion tracking not detected');}scores.ppc={score:p15Clamp(n),confidence:'high',why};}
  else scores.ppc={score:null,confidence:'unchecked',why:['Tracking audit needed']};

  const gbpKnown=l.gbpClaimed===true||l.gbpClaimed===false||l.mapRankChecked===true;
  if(gbpKnown){let n=0,why=[];if(l.gbpClaimed===false){n+=55;why.push('GBP verified unclaimed');}if(l.mapRankChecked===true&&l.mapRank==null){n+=35;why.push('No verified Maps ranking found');}else if(l.mapRankChecked===true&&Number(l.mapRank)>3){n+=25;why.push(`Verified Maps rank ${l.mapRank}`);}scores.gbp={score:p15Clamp(n),confidence:'verified',why};}
  else scores.gbp={score:null,confidence:'unchecked',why:['Google Business data not verified']};

  const labels={website:'Website / Conversion',seo:'SEO',social:'Social Media',ppc:'PPC / Tracking',gbp:'Google Business Profile'};
  const ranked=Object.entries(scores).filter(([,v])=>v.score!=null).sort((a,b)=>b[1].score-a[1].score);
  const best=ranked[0]?{key:ranked[0][0],label:labels[ranked[0][0]],score:ranked[0][1].score}:null;
  return{...scores,best,generatedAt:new Date().toISOString()};
}

function p15IssueText(l){const r=lowHangingScore(l).reasons.map(x=>x[0]);return r.filter(x=>!/Phone available|Email available|Decision maker identified|Social contact path available/i.test(x)).slice(0,4);}
function p15SalesPrep(l){
  const svc=p15ServiceScores(l),issues=p15IssueText(l),best=svc.best?.label||'digital marketing',person=l.decisionMaker?l.decisionMaker.split(/\s+/)[0]:'there';
  const evidence=issues.length?issues.join(', '):'a few areas where the online presence could be stronger';
  const callPoints=[`Lead with ${best}.`,...issues.slice(0,3),l.decisionMaker?`Ask for ${l.decisionMaker}${l.title?` (${l.title})`:''}.`:'Ask who handles marketing decisions.',l.phone?'Phone is available for your outside-CRM call workflow.':'Use email/social if available.'];
  const emailSubject=`Quick idea for ${l.name}`;
  const emailBody=`Hi ${person},\n\nI was looking at ${l.name}'s online presence and noticed ${evidence}. I work with local businesses through Skylight Reflections Marketing, and I see an opportunity around ${best.toLowerCase()} that could make it easier for potential customers to find you and take action.\n\nIf it makes sense, I’d be happy to share the specific improvements I noticed and what I would prioritize first.\n\nThanks,\nRay\nSkylight Reflections Marketing`;
  const socialMessage=`Hi ${person} — I came across ${l.name} and noticed a few opportunities around ${best.toLowerCase()} (${issues.slice(0,2).join(' and ')||'your online presence'}). I help local businesses improve these areas through Skylight Reflections Marketing. I’d be glad to share the specific items I found.`;
  const followUp=`Hi ${person}, just following up on my note about ${l.name}. The main opportunity I spotted was ${best.toLowerCase()}${issues[0]?`, especially ${issues[0].toLowerCase()}`:''}. If improving that is on your radar, I can send over a short breakdown of what I’d tackle first.`;
  const callOpening=`Hi, this is Ray with Skylight Reflections Marketing. I was reviewing ${l.name}'s online presence and noticed a couple of areas that may be making it harder to turn online visitors into leads. I wanted to see who handles your marketing or website decisions.`;
  return{bestOffer:svc.best,issues,callOpening,callPoints,emailSubject,emailBody,socialMessage,followUp,generatedAt:new Date().toISOString(),evidenceOnly:true};
}

function p15PeerPool(l){
  let pool=(state.results||[]).filter(x=>!same(x,l)&&String(x.niche||'').toLowerCase()===String(l.niche||'').toLowerCase()&&String(x.city||'').toLowerCase()===String(l.city||'').toLowerCase());
  if(pool.length<2)pool=(state.saved||[]).filter(x=>!same(x,l)&&String(x.niche||'').toLowerCase()===String(l.niche||'').toLowerCase()&&String(x.city||'').toLowerCase()===String(l.city||'').toLowerCase());
  return pool;
}
function p15CompetitorSnapshot(l){
  const peers=p15PeerPool(l);if(peers.length<2)return{available:false,sampleSize:peers.length,note:'Need at least 2 comparable local prospects in the current data set.'};
  const audited=peers.filter(x=>x.website&&x.auditChecked===true),socialKnown=peers.filter(x=>x.freeContactChecked===true||p15SocialCount(x)>0),fresh=peers.map(bpFreshnessDays).filter(x=>x!=null),insights=[];
  const avgWeb=p15Avg(audited.map(x=>Number(x.webScore)||0)),avgSocial=p15Avg(socialKnown.map(p15SocialCount)),avgFresh=p15Avg(fresh),avgLH=p15Avg(peers.map(x=>lowHangingScore(x).score));
  if(!l.website&&peers.filter(x=>x.website).length/peers.length>=.5)insights.push('Most comparable businesses in this result set have a website; this prospect does not.');
  if(l.auditChecked===true&&avgWeb!=null&&Number(l.webScore)+10<avgWeb)insights.push(`Website score is ${Math.round(avgWeb-Number(l.webScore))} points below the peer average.`);
  if((l.freeContactChecked===true||p15SocialCount(l)>0)&&avgSocial!=null&&p15SocialCount(l)<avgSocial)insights.push(`Social presence is below the peer average (${p15SocialCount(l)} vs ${avgSocial.toFixed(1)} profiles).`);
  const fd=bpFreshnessDays(l);if(fd!=null&&avgFresh!=null&&fd>avgFresh+180)insights.push('Website appears materially staler than the peer average.');
  const trackingPeers=audited.filter(x=>x.analytics===true||x.analytics===false);if(l.analytics===false&&trackingPeers.length&&trackingPeers.filter(x=>x.analytics===true).length/trackingPeers.length>=.5)insights.push('Analytics is missing while most audited peers have it.');
  return{available:true,sampleSize:peers.length,market:`${l.niche||'Local business'} · ${l.city||''} ${l.state||''}`.trim(),averages:{websiteScore:avgWeb==null?null:Math.round(avgWeb),socialProfiles:avgSocial==null?null:Number(avgSocial.toFixed(1)),freshnessDays:avgFresh==null?null:Math.round(avgFresh),lowHangingScore:avgLH==null?null:Math.round(avgLH)},contactCoverage:{phone:p15Pct(peers.filter(x=>x.phone).length,peers.length),email:p15Pct(peers.filter(x=>x.email).length,peers.length),decisionMaker:p15Pct(peers.filter(x=>x.decisionMaker).length,peers.length)},insights,note:'Comparison uses the currently collected local result set; it is not a complete market-share study.',generatedAt:new Date().toISOString()};
}

const p15DbBase=dbToLead;dbToLead=function(r){const l=p15DbBase(r);l.serviceOpportunity=r.service_opportunity||{};l.competitorSnapshot=r.competitor_snapshot||{};l.salesPrep=r.sales_prep||{};return l};
const p15LdBase=leadToDb;leadToDb=function(l){const d=p15LdBase(l);d.service_opportunity=p15ServiceScores(l);d.competitor_snapshot=p15CompetitorSnapshot(l);d.sales_prep=p15SalesPrep(l);return d};