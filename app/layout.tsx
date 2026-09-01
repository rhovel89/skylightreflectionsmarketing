import type{Metadata}from'next';import'./globals.css';import'./v15-polish.css';import{getSite}from'@/lib/data'
export async function generateMetadata():Promise<Metadata>{const site=await getSite();return{title:{default:site.default_seo_title||`${site.directory_name} | Find the Right Local Pro.`,template:`%s | ${site.directory_name}`},description:site.default_meta_description||site.hero_subtitle,robots:{index:true,follow:true}}}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
