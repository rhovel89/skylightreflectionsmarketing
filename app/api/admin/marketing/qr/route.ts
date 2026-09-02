import { NextResponse } from 'next/server'
import { getClaims,getRoles } from '@/lib/auth'

export async function GET(req:Request){
 const claims=await getClaims();if(!claims?.sub)return NextResponse.json({error:'Unauthorized'},{status:401});const roles=await getRoles(String(claims.sub));if(!roles.includes('super_admin'))return NextResponse.json({error:'Super Admin access required.'},{status:403})
 const u=new URL(req.url),data=String(u.searchParams.get('data')||'').trim();if(!data||data.length>1800)return NextResponse.json({error:'A valid QR destination is required.'},{status:400})
 try{const parsed=new URL(data);if(!['https:','http:'].includes(parsed.protocol))throw new Error('invalid')}catch{return NextResponse.json({error:'QR destination must be an HTTP or HTTPS URL.'},{status:400})}
 const qr=new URL('https://quickchart.io/qr');qr.searchParams.set('text',data);qr.searchParams.set('size','300');qr.searchParams.set('margin','2');qr.searchParams.set('ecLevel','M');qr.searchParams.set('format','png');const r=await fetch(qr,{cache:'no-store'});if(!r.ok)return NextResponse.json({error:'Unable to generate QR code.'},{status:502});const bytes=await r.arrayBuffer();return new NextResponse(bytes,{status:200,headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}})
}
