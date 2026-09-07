import { createHash } from 'node:crypto'

export type CsvRow=Record<string,string>

export function parseDelimited(input:string):CsvRow[]{
  const text=String(input||'').replace(/^\uFEFF/,'').trim()
  if(!text)return []
  const first=text.split(/\r?\n/,1)[0]||''
  const delimiter=first.includes('\t')?'\t':','
  const rows:string[][]=[]
  let row:string[]=[],cell='',quoted=false
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++}
      else quoted=!quoted
      continue
    }
    if(ch===delimiter&&!quoted){row.push(cell.trim());cell='';continue}
    if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&text[i+1]==='\n')i++
      row.push(cell.trim());cell=''
      if(row.some(Boolean))rows.push(row)
      row=[]
      continue
    }
    cell+=ch
  }
  row.push(cell.trim())
  if(row.some(Boolean))rows.push(row)
  if(rows.length<2)return []
  const headers=rows[0].map((h,i)=>normalizeHeader(h)||`column_${i+1}`)
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])))
}

export function normalizeHeader(value:string){
  return String(value||'').trim().toLowerCase().replace(/[%()]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')
}
export function pick(row:CsvRow,...keys:string[]){
  for(const key of keys){const value=row[normalizeHeader(key)];if(value!==undefined&&String(value).trim()!=='')return String(value).trim()}
  return ''
}
export function numberValue(value:any){
  const raw=String(value??'').replace(/,/g,'').replace(/\$/g,'').trim()
  if(!raw)return null
  const n=Number(raw.replace(/%$/,''))
  return Number.isFinite(n)?n:null
}
export function ctrValue(value:any){
  const raw=String(value??'').trim(),n=numberValue(raw)
  if(n===null)return null
  return raw.includes('%')?n/100:n>1?n/100:n
}
export function isoDate(value:any){
  const raw=String(value??'').trim()
  if(!raw)return null
  const d=new Date(raw)
  if(Number.isNaN(d.getTime()))return null
  return d.toISOString().slice(0,10)
}
export function monthStart(value:any){
  const raw=String(value??'').trim()
  if(!raw)return null
  const direct=isoDate(raw)
  if(direct)return direct.slice(0,7)+'-01'
  const d=new Date(`${raw} 1`)
  return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,7)+'-01'
}
export function metricName(value:string){
  return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)
}
export function fingerprint(parts:any[]){
  return createHash('sha256').update(parts.map(v=>String(v??'')).join('\x1f')).digest('hex')
}
export function validHttpUrl(value:string){
  try{const u=new URL(value);return u.protocol==='http:'||u.protocol==='https:'}catch{return false}
}
export function googleVisibilityApiConfigured(){
  return Boolean(process.env.GOOGLE_VISIBILITY_CLIENT_ID?.trim()&&process.env.GOOGLE_VISIBILITY_CLIENT_SECRET?.trim()&&process.env.GOOGLE_VISIBILITY_REFRESH_TOKEN?.trim())
}
export async function googleAccessToken(){
  const clientId=process.env.GOOGLE_VISIBILITY_CLIENT_ID?.trim(),clientSecret=process.env.GOOGLE_VISIBILITY_CLIENT_SECRET?.trim(),refreshToken=process.env.GOOGLE_VISIBILITY_REFRESH_TOKEN?.trim()
  if(!clientId||!clientSecret||!refreshToken)throw new Error('Google Visibility OAuth credentials are not configured.')
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'}),cache:'no-store'})
  const data:any=await response.json().catch(()=>({}))
  if(!response.ok||!data?.access_token)throw new Error(`Google OAuth refresh failed (${response.status}).`)
  return String(data.access_token)
}
export async function googleJson(url:string,accessToken:string,init?:RequestInit){
  const response=await fetch(url,{...init,headers:{...(init?.headers||{}),authorization:`Bearer ${accessToken}`,accept:'application/json'},cache:'no-store'})
  const data:any=await response.json().catch(()=>({}))
  if(!response.ok){const message=data?.error?.message||data?.error_description||`Google API request failed (${response.status}).`;throw new Error(String(message).slice(0,1200))}
  return data
}
export function dateParts(value:string){const [year,month,day]=value.split('-').map(Number);return {year,month,day}}
export function daysAgo(days:number){return new Date(Date.now()-days*86400000).toISOString().slice(0,10)}
