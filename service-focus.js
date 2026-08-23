const sfBaseServiceScores=p15ServiceScores;
p15ServiceScores=function(l){
  const scores=sfBaseServiceScores(l),wa=p15AuditData(l);
  const formSignal=wa.has_form??wa.hasForm??wa.form_present??wa.formPresent??(Array.isArray(wa.forms)?wa.forms.length>0:null);
  let funnel;
  if(!l.website){
    funnel={score:100,confidence:'high',why:['No website or online conversion path found']};
  }else if(l.auditChecked===true){
    let n=0,why=[];
    if(Number(l.webScore)<60){n+=25;why.push(`Website score ${Math.round(Number(l.webScore)||0)}/100`)}
    if(l.ctaStrong===false){n+=40;why.push('Weak calls to action')}
    if(formSignal===false){n+=25;why.push('No lead-capture form detected')}
    const phoneClick=wa.clickable_phone??wa.clickablePhone,emailClick=wa.clickable_email??wa.clickableEmail;
    if(phoneClick===false&&emailClick===false){n+=10;why.push('No obvious clickable contact path detected')}
    funnel={score:p15Clamp(n),confidence:'high',why:why.length?why:['Basic conversion path detected']};
  }else{
    funnel={score:null,confidence:'unchecked',why:['Website audit needed to score funnel opportunity']};
  }
  scores.funnel=funnel;
  const labels={website:'Web Design',seo:'SEO',funnel:'Funnel Design',social:'Social Media',ppc:'PPC / Tracking',gbp:'Google Business Profile'};
  const core=new Set(['website','seo','funnel']);
  const ranked=Object.entries(scores).filter(([k,v])=>labels[k]&&v?.score!=null).sort((a,b)=>((b[1].score+(core.has(b[0])?6:0))-(a[1].score+(core.has(a[0])?6:0)))||(b[1].score-a[1].score));
  scores.best=ranked[0]?{key:ranked[0][0],label:labels[ranked[0][0]],score:ranked[0][1].score}:null;
  return scores;
};

const sfDrawerBase=drawer;
drawer=function(){
  let h=sfDrawerBase();if(!state.selected)return h;
  const svc=p15ServiceScores(state.selected),start=h.indexOf('<div class=section><b>Service Opportunity Scores</b>');
  if(start>=0){
    const notice=h.indexOf('<div class=notice><b>Best first offer:</b>',start);
    if(notice>start){
      const close=h.lastIndexOf('</div>',notice);
      if(close>start)h=h.slice(0,close)+p15ScoreCard('Funnel Design',svc.funnel)+h.slice(close);
    }
    const end=h.indexOf('</div><div class=section><b>Competitor Snapshot</b>',start);
    const stop=end>start?end:h.length;
    let section=h.slice(start,stop).replace('<span>Website</span>','<span>Web Design</span>');
    section=section.replace('<b>Service Opportunity Scores</b>','<b>Service Opportunity Scores</b><div class=sub style="margin-top:5px">Core focus: Web Design · SEO · Funnel Design</div>');
    h=h.slice(0,start)+section+h.slice(stop);
  }
  return h;
};
