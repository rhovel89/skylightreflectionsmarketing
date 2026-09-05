import type{Metadata}from'next'
import{notFound}from'next/navigation'
import{SiteShell}from'@/components/SiteShell'
import{PublicBusinessCommerce}from'@/components/PublicBusinessCommerce'
import{getBusiness}from'@/lib/data'
import{getSiteUrl}from'@/lib/site-url'

export const dynamic='force-dynamic'
const related=(v:any)=>Array.isArray(v)?v[0]:v
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params,b=await getBusiness(slug);if(!b)return{title:'Business Not Found',robots:{index:false,follow:false}};const canonical=`${getSiteUrl()}/business/${b.slug}/community`;return{title:`${b.name} Deals, Local Faves & Community`,description:`See current offers, community recommendations, structured services, projects and published Q&A for ${b.name}.`,alternates:{canonical},robots:{index:true,follow:true}}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const{slug}=await params,b=await getBusiness(slug);if(!b)notFound();const cats=(b.business_categories??[]).map((x:any)=>related(x.categories)?.name).filter(Boolean),branches=(b.business_locations??[]).filter((x:any)=>x.is_active!==false),primary=branches.find((x:any)=>x.is_primary)||branches[0];return <SiteShell><main><PublicBusinessCommerce businessId={b.id} businessName={b.name} service={cats[0]||''} city={primary?.city||''} slug={b.slug}/></main></SiteShell>}
