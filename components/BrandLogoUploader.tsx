'use client'

import{FormEvent,useRef,useState}from'react';
import{useRouter}from'next/navigation';
import{createClient}from'@/lib/supabase/client';
import{activateBrandLogo}from'@/app/admin/site-settings-actions';

const TYPES=new Set(['image/jpeg','image/png','image/webp']);
const MAX_BYTES=5*1024*1024;

export function BrandLogoUploader({tenantId,currentUrl}:{tenantId:string;currentUrl?:string|null}){
  const inputRef=useRef<HTMLInputElement>(null);
  const router=useRouter();
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[success,setSuccess]=useState('');
  const[logoUrl,setLogoUrl]=useState(currentUrl||'');

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    const file=inputRef.current?.files?.[0];
    setError('');setSuccess('');
    if(!file){setError('Choose a logo image to upload.');return}
    if(file.size>MAX_BYTES){setError('Logo image must be 5 MB or smaller.');return}
    if(!TYPES.has(file.type)){setError('Use a PNG, JPEG or WebP logo image.');return}

    setBusy(true);
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=`${tenantId}/branding/${crypto.randomUUID()}.${ext}`;
    const s=createClient();
    try{
      const{error:uploadError}=await s.storage.from('site-assets').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
      if(uploadError)throw new Error(uploadError.message);
      try{
        const result=await activateBrandLogo(path);
        setLogoUrl(result.publicUrl);
        setSuccess('Logo uploaded and activated successfully.');
        if(inputRef.current)inputRef.current.value='';
        router.refresh();
      }catch(activationError){
        await s.storage.from('site-assets').remove([path]);
        throw activationError;
      }
    }catch(err){
      setError(err instanceof Error?err.message:'Unable to upload the logo.');
    }finally{setBusy(false)}
  }

  return <div className="admin-card">
    <div className="kpi">Durable Brand Asset</div>
    <h2>Skylight Reflections Marketing Logo</h2>
    <p className="muted">Upload the final website-ready Skylight logo directly to this project's Supabase site-assets storage. The image does not pass through a Vercel Function.</p>
    {logoUrl?<div style={{display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',margin:'16px 0'}}><div style={{padding:12,border:'1px solid #d8dbe5',borderRadius:12,background:'#fff'}}><img src={logoUrl} alt="Current Skylight Reflections Marketing logo" style={{display:'block',maxWidth:280,maxHeight:120,width:'auto',height:'auto'}}/></div><div><span className="badge verified">Current logo configured</span><p className="small muted" style={{maxWidth:520}}>A successful replacement immediately updates the site-wide logo setting. Previous managed logo assets are cleaned up after activation.</p></div></div>:<div className="notice warn">No durable final logo is configured yet. The public site is using the local Skylight-styled fallback.</div>}
    <form onSubmit={submit} className="form-card" style={{marginTop:16}}>
      <label>Final Logo Image<input ref={inputRef} type="file" name="logo_file" accept="image/png,image/jpeg,image/webp" required disabled={busy}/></label>
      <button className="btn btn-primary" style={{marginTop:12}} disabled={busy}>{busy?'Uploading…':'Upload & Use Logo'}</button>
      <p className="small muted">PNG, JPEG or WebP · maximum 5 MB. PNG or WebP with a clean/transparent background is preferred when available.</p>
      {error&&<div className="notice warn" style={{marginTop:12}}>{error}</div>}
      {success&&<div className="notice success" style={{marginTop:12}}>{success}</div>}
    </form>
    <div className="notice" style={{marginTop:14}}>Authoritative Canva source references: <b>DAFMpifRS1E — Skylight Reflections</b> and square logo candidate <b>DAFDWUF1xb8</b>. Use the final exported artwork rather than a temporary Canva preview URL.</div>
  </div>
}
