import Link from 'next/link'
import { BrandLogo } from './BrandLogo'
import type { NavItem,SiteSettings } from '@/lib/types'
import { VERTICALS } from '@/lib/constants'
export function Header({site,navigation=[]}:{site:SiteSettings;navigation?:NavItem[]}){
 const header=navigation.filter(n=>n.menu_key==='header'&&n.is_visible).sort((a,b)=>a.sort_order-b.sort_order)
 const links=header.length?header:VERTICALS.map((v,i)=>({id:v.key,menu_key:'header',label:v.label,href:v.href,sort_order:i,is_visible:true}))
 return <header className="topbar"><div className="container nav"><Link href="/" className="brand-link"><BrandLogo site={site} compact/></Link><nav className="navlinks">{links.map(n=><Link key={n.id} href={n.href}>{n.label}</Link>)}</nav><div className="nav-actions"><Link className="btn btn-primary" href="/for-businesses#list">List Your Business</Link><Link className="btn btn-light" href="/account">My Account</Link></div></div></header>
}
