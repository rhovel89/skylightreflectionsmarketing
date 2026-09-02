'use client'

import { useMemo, useRef, useState } from 'react'

type LocationOption = { name:string; type:string; county?:string|null }
type CategoryOption = { name:string; slug:string; vertical:string }
type Props = { locations:LocationOption[]; categories:CategoryOption[]; siteUrl:string; canvaClientConfigured:boolean }

type FormatKey = 'square'|'portrait'|'story'|'flyer'
const formats: Record<FormatKey,{label:string;width:number;height:number}> = {
  square:{label:'Square Social · 1080×1080',width:1080,height:1080},
  portrait:{label:'Portrait Social · 1080×1350',width:1080,height:1350},
  story:{label:'Story / Reel · 1080×1920',width:1080,height:1920},
  flyer:{label:'Flyer · 1275×1650',width:1275,height:1650},
}

const presets = [
  {name:'Directory Awareness',headline:'Find the Right Local Pro.',sub:'Discover trusted local businesses across Central Illinois — all in one place.',cta:'Explore Local Pros'},
  {name:'List Your Business',headline:'Get Found by Local Customers.',sub:'Add your business to Central Illinois Local Pros and build visibility in your market.',cta:'List Your Business'},
  {name:'Claim Your Listing',headline:'Is Your Business Already Listed?',sub:'Claim your profile, keep your information accurate, and unlock owner tools.',cta:'Claim Your Listing'},
  {name:'Featured Visibility',headline:'Stand Out Where Locals Are Searching.',sub:'Promote your business with clearly labeled Featured placement across Central Illinois Local Pros.',cta:'See Featured Options'},
  {name:'Restaurant Spotlight',headline:'Hungry? Find Something Local.',sub:'Browse restaurants, cafes, bakeries, bars and more across Central Illinois.',cta:'Find Restaurants'},
  {name:'Attorney Spotlight',headline:'Need a Local Attorney?',sub:'Compare Central Illinois legal professionals by practice area and location.',cta:'Find Attorneys'},
  {name:'Shop Local',headline:'Shop Local. Support Local.',sub:'Discover independent stores, specialty shops and local favorites near you.',cta:'Explore Local Stores'},
]

function wrap(value:string,max:number){
  const words=value.trim().split(/\s+/).filter(Boolean);const lines:string[]=[];let current=''
  words.forEach(word=>{const next=current?`${current} ${word}`:word;if(next.length>max&&current){lines.push(current);current=word}else current=next});if(current)lines.push(current);return lines.slice(0,4)
}

export function MarketingStudio({locations,categories,siteUrl,canvaClientConfigured}:Props){
  const svgRef=useRef<SVGSVGElement>(null)
  const [format,setFormat]=useState<FormatKey>('portrait')
  const [preset,setPreset]=useState(presets[0].name)
  const [headline,setHeadline]=useState(presets[0].headline)
  const [subheadline,setSubheadline]=useState(presets[0].sub)
  const [cta,setCta]=useState(presets[0].cta)
  const [location,setLocation]=useState('')
  const [category,setCategory]=useState('')
  const [phone,setPhone]=useState('')
  const [url,setUrl]=useState(siteUrl)
  const [eyebrow,setEyebrow]=useState('CENTRAL ILLINOIS LOCAL PROS')
  const [copied,setCopied]=useState('')
  const spec=formats[format]
  const locationLabel=location || 'Central Illinois'
  const categoryLabel=category || 'Local Businesses'
  const headlineLines=useMemo(()=>wrap(headline,format==='story'?24:30),[headline,format])
  const subLines=useMemo(()=>wrap(subheadline,format==='story'?34:44),[subheadline,format])

  const choosePreset=(name:string)=>{const p=presets.find(x=>x.name===name);if(!p)return;setPreset(name);setHeadline(p.headline);setSubheadline(p.sub);setCta(p.cta)}
  const copy=async(label:string,text:string)=>{try{await navigator.clipboard.writeText(text);setCopied(label);setTimeout(()=>setCopied(''),1400)}catch{}}
  const caption=`${headline}\n\n${subheadline}\n\n${location ? `📍 ${location}, IL\n` : ''}${category ? `${category}\n` : ''}${cta}: ${url}${phone ? `\nCall/Text: ${phone}` : ''}\n\n#CentralIllinois #LocalBusiness #ShopLocal #CentralILLocalPros`
  const canvaBrief=`Create a polished ${formats[format].label} marketing graphic for Central Illinois Local Pros, powered by Skylight Reflections Marketing. Use a premium black, purple, blue and cyan visual system. Headline: “${headline}” Subheadline: “${subheadline}” Market: “${locationLabel}” Category: “${categoryLabel}” CTA: “${cta}” URL: “${url}”${phone?` Phone: “${phone}”`:''}. Keep the design modern, high-contrast, local-business focused, and easy to read on mobile.`

  const serialize=()=>{if(!svgRef.current)return '';const clone=svgRef.current.cloneNode(true) as SVGSVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');return new XMLSerializer().serializeToString(clone)}
  const filename=()=>`central-il-local-pros-${preset.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${format}`
  const downloadSvg=()=>{const xml=serialize();if(!xml)return;const blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${filename()}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  const downloadPng=()=>{const xml=serialize();if(!xml)return;const blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});const src=URL.createObjectURL(blob);const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=spec.width;canvas.height=spec.height;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.drawImage(img,0,0,spec.width,spec.height);URL.revokeObjectURL(src);canvas.toBlob(out=>{if(!out)return;const a=document.createElement('a');a.href=URL.createObjectURL(out);a.download=`${filename()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)},'image/png')};img.src=src}

  const topPad=format==='story'?210:format==='flyer'?170:135
  const headlineSize=format==='story'?92:format==='flyer'?82:74
  const subSize=format==='story'?42:format==='flyer'?36:32
  const cardY=spec.height-(format==='story'?520:format==='flyer'?405:345)

  return <div className="grid grid-2" style={{alignItems:'start',gap:22}}>
    <div>
      <div className="admin-card">
        <div className="kpi">Campaign Builder</div><h2>Create the public-facing asset</h2><p className="small muted">Build branded social graphics and flyers directly inside Super Admin. Nothing is published automatically.</p>
        <div className="grid grid-2" style={{marginTop:14}}>
          <label className="field"><span>Campaign Preset</span><select value={preset} onChange={e=>choosePreset(e.target.value)}>{presets.map(p=><option key={p.name}>{p.name}</option>)}</select></label>
          <label className="field"><span>Format</span><select value={format} onChange={e=>setFormat(e.target.value as FormatKey)}>{Object.entries(formats).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
          <label className="field"><span>City / Town / Market</span><select value={location} onChange={e=>setLocation(e.target.value)}><option value="">All Central Illinois</option>{locations.map((l,i)=><option key={`${l.name}-${i}`} value={l.name}>{l.name} · {l.type}{l.county?` · ${l.county} County`:''}</option>)}</select></label>
          <label className="field"><span>Category</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All Local Businesses</option>{categories.map(c=><option key={c.slug} value={c.name}>{c.name} · {c.vertical.replace(/_/g,' ')}</option>)}</select></label>
        </div>
        <label className="field" style={{marginTop:12}}><span>Eyebrow</span><input value={eyebrow} onChange={e=>setEyebrow(e.target.value)} /></label>
        <label className="field" style={{marginTop:12}}><span>Headline</span><input value={headline} onChange={e=>setHeadline(e.target.value)} /></label>
        <label className="field" style={{marginTop:12}}><span>Subheadline</span><textarea rows={3} value={subheadline} onChange={e=>setSubheadline(e.target.value)} /></label>
        <div className="grid grid-2" style={{marginTop:12}}>
          <label className="field"><span>CTA Button</span><input value={cta} onChange={e=>setCta(e.target.value)} /></label>
          <label className="field"><span>Public URL</span><input value={url} onChange={e=>setUrl(e.target.value)} /></label>
          <label className="field"><span>Optional Phone</span><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="217-..." /></label>
        </div>
      </div>

      <div className="admin-card" style={{marginTop:18}}>
        <div className="kpi">Campaign Copy</div><h2>Caption & Canva brief</h2>
        <textarea className="admin-json" rows={9} value={caption} readOnly style={{width:'100%'}} />
        <div className="card-actions" style={{marginTop:10}}><button type="button" className="btn btn-light" onClick={()=>copy('caption',caption)}>{copied==='caption'?'Copied ✓':'Copy Caption'}</button><button type="button" className="btn btn-light" onClick={()=>copy('brief',canvaBrief)}>{copied==='brief'?'Copied ✓':'Copy Canva Brief'}</button></div>
      </div>

      <div className="admin-card" style={{marginTop:18}}>
        <div className="kpi">Canva Publishing Bridge</div><h2>{canvaClientConfigured?'Canva developer client detected':'Canva handoff ready'}</h2>
        <p className="small muted">Use the generated PNG/SVG as the source asset, then continue editing or resizing in Canva. A true one-click Connect API workflow requires a Canva Developer integration and OAuth credentials; those credentials are never placed in browser code.</p>
        <div className="card-actions"><button type="button" className="btn btn-primary" onClick={()=>window.open('https://www.canva.com/','_blank','noopener,noreferrer')}>Open Canva</button><a className="btn btn-light" href="https://www.canva.com/developers/" target="_blank" rel="noreferrer">Canva Developer Portal</a></div>
      </div>
    </div>

    <div style={{position:'sticky',top:18}}>
      <div className="admin-card">
        <div className="section-head" style={{marginBottom:12}}><div><div className="kpi">Live Preview</div><h2>{formats[format].label}</h2></div></div>
        <div style={{background:'#0b0b10',borderRadius:18,padding:14,display:'flex',justifyContent:'center'}}>
          <svg ref={svgRef} viewBox={`0 0 ${spec.width} ${spec.height}`} width="100%" role="img" aria-label="Marketing asset preview" style={{maxHeight:720,borderRadius:14,boxShadow:'0 20px 60px rgba(0,0,0,.35)'}}>
            <defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#050507"/><stop offset="0.48" stopColor="#19003f"/><stop offset="1" stopColor="#00486c"/></linearGradient><linearGradient id="accent" x1="0" x2="1"><stop offset="0" stopColor="#8a4dff"/><stop offset="1" stopColor="#00d9ff"/></linearGradient></defs>
            <rect width={spec.width} height={spec.height} fill="url(#bg)"/>
            <circle cx={spec.width*0.88} cy={spec.height*0.12} r={spec.width*0.28} fill="#4a00e0" opacity=".22"/><circle cx={spec.width*0.08} cy={spec.height*0.82} r={spec.width*0.34} fill="#00cfea" opacity=".13"/>
            <rect x="70" y="70" width={spec.width-140} height="10" rx="5" fill="url(#accent)"/>
            <text x="80" y={topPad-65} fill="#78e9ff" fontFamily="Arial, Helvetica, sans-serif" fontSize={format==='story'?28:24} fontWeight="700" letterSpacing="3">{eyebrow.toUpperCase()}</text>
            <text x="80" y={topPad} fill="#ffffff" fontFamily="Arial, Helvetica, sans-serif" fontSize={headlineSize} fontWeight="800">
              {headlineLines.map((line,i)=><tspan key={i} x="80" dy={i===0?0:headlineSize*1.05}>{line}</tspan>)}
            </text>
            <text x="82" y={topPad+headlineLines.length*headlineSize*1.08+55} fill="#d9dce7" fontFamily="Arial, Helvetica, sans-serif" fontSize={subSize} fontWeight="400">
              {subLines.map((line,i)=><tspan key={i} x="82" dy={i===0?0:subSize*1.35}>{line}</tspan>)}
            </text>
            <rect x="72" y={cardY} width={spec.width-144} height={format==='story'?330:255} rx="30" fill="#ffffff" opacity=".98"/>
            <text x="110" y={cardY+72} fill="#1a1530" fontFamily="Arial, Helvetica, sans-serif" fontSize={format==='story'?34:30} fontWeight="800">{locationLabel}</text>
            <text x="110" y={cardY+122} fill="#565168" fontFamily="Arial, Helvetica, sans-serif" fontSize={format==='story'?28:24}>{categoryLabel}</text>
            <rect x="110" y={cardY+158} width={Math.min(spec.width-220,format==='story'?610:540)} height={format==='story'?92:76} rx="18" fill="url(#accent)"/>
            <text x="142" y={cardY+(format==='story'?218:208)} fill="#ffffff" fontFamily="Arial, Helvetica, sans-serif" fontSize={format==='story'?30:27} fontWeight="800">{cta}</text>
            <text x="110" y={cardY+(format==='story'?298:238)} fill="#29243b" fontFamily="Arial, Helvetica, sans-serif" fontSize={format==='story'?24:20} fontWeight="700">{url.replace(/^https?:\/\//,'')}</text>
            <text x="80" y={spec.height-58} fill="#b9bed0" fontFamily="Arial, Helvetica, sans-serif" fontSize={format==='story'?22:18}>Powered by Skylight Reflections Marketing{phone?`  •  ${phone}`:''}</text>
          </svg>
        </div>
        <div className="card-actions" style={{marginTop:14}}><button type="button" className="btn btn-primary" onClick={downloadPng}>Download PNG</button><button type="button" className="btn btn-light" onClick={downloadSvg}>Download SVG</button></div>
        <p className="small muted" style={{marginTop:10}}>Exports are generated locally in your browser from the preview. They are not automatically published, emailed, posted or sent to prospects.</p>
      </div>
    </div>
  </div>
}
