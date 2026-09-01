import type { SiteSettings } from '@/lib/types'
export function BrandLogo({site,compact=false}:{site:SiteSettings;compact?:boolean}){
 const name=site.directory_name??'Central Illinois Local Pros'; const logo=site.brand_logo_url
 return <span className="brand-lockup"><span className="brand-mark"><img src={logo||'/skylight-brand-fallback.svg'} alt="Skylight Reflections Marketing logo" /></span><span className="brand-copy"><strong>{compact?'CENTRAL IL LOCAL PROS':name}</strong><small>{site.footer_text??'Powered by Skylight Reflections Marketing'}</small></span></span>
}
