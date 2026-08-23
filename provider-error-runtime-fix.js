// Provider runtime fix: surface real Google/OpenAI Edge Function errors instead of generic Supabase wrapper messages.
(function(){
  if(typeof sb==='undefined'||!sb?.functions?.invoke)return;
  if(sb.functions.__providerRuntimeFix)return;
  const originalInvoke=sb.functions.invoke.bind(sb.functions);
  async function extractBody(error){
    try{
      const ctx=error?.context;
      if(ctx&&typeof ctx.clone==='function'){
        const r=ctx.clone();
        const ct=(r.headers?.get?.('content-type')||'').toLowerCase();
        if(ct.includes('application/json')) return await r.json();
        const t=await r.text();
        try{return JSON.parse(t)}catch{return {error:t}}
      }
    }catch(e){console.warn('Could not extract provider error body',e)}
    return null;
  }
  sb.functions.invoke=async function(name,options){
    const result=await originalInvoke(name,options);
    if(!['google-place-refresh','ai-sales-assistant'].includes(String(name))) return result;
    if(result?.error){
      const body=await extractBody(result.error);
      if(body&&typeof body==='object') return {data:body,error:null};
    }
    return result;
  };
  sb.functions.__providerRuntimeFix=true;
})();
