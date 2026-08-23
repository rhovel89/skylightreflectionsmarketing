// Editing polish for Templates + Funnel Studio.
(function(){
  if(typeof state==='undefined'||!state.salesTools)return;
  if(typeof stUpdateMerge==='function'){
    stUpdateMerge=function(k,v){state.salesTools.templates.merge[k]=v};
  }
  if(typeof fsSet==='function'){
    const baseFsSet=fsSet;
    fsSet=function(k,v){
      if(k==='niche')return baseFsSet(k,v);
      state.salesTools.funnel[k]=v;
    };
  }
  window.stRefreshPreview=function(){render();toast('Message preview refreshed.')};
  window.fsRefreshPreview=function(){render();toast('Funnel preview refreshed.')};
  function patch(){
    if(state.view==='templates'){
      const panels=[...document.querySelectorAll('.panel')];
      const live=panels.find(p=>p.textContent.includes('LIVE PREVIEW'));
      if(live&&!live.querySelector('.st-refresh')){
        const body=live.querySelector('[style*="padding:14px"]')||live;
        const b=document.createElement('button');b.className='btn st-refresh';b.textContent='Refresh Preview';b.onclick=stRefreshPreview;body.appendChild(b);
      }
    }
    if(state.view==='funnelstudio'){
      const panels=[...document.querySelectorAll('.panel')];
      const builder=panels.find(p=>p.textContent.includes('FUNNEL BUILDER'));
      if(builder&&!builder.querySelector('.fs-refresh')){
        const actions=[...builder.querySelectorAll('div')].find(x=>x.querySelector?.('button')&&x.textContent.includes('Save Funnel Preview'));
        if(actions){const b=document.createElement('button');b.className='btn fs-refresh';b.textContent='Refresh Funnel Preview';b.onclick=fsRefreshPreview;actions.appendChild(b)}
      }
      // Goal is niche-preset strategy in v1; keep it visible but read-only rather than pretending edits change the strategy model.
      if(builder){const labels=[...builder.querySelectorAll('label.field')];const goal=labels.find(l=>l.querySelector('span')?.textContent.trim()==='Goal');const inp=goal?.querySelector('input');if(inp){inp.readOnly=true;inp.title='Goal is selected by the niche preset in this version.'}}
    }
  }
  const baseRender=render;
  render=function(){baseRender();queueMicrotask(patch)};
  render();
})();