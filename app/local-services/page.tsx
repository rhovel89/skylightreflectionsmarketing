import type { Metadata } from 'next'
import { VerticalPage } from '@/components/VerticalPage'

export const dynamic='force-dynamic'
export const metadata:Metadata={
  title:'Local Services in Central Illinois',
  description:'Find independent Central Illinois service providers such as pet care, auto detailing, recycling and other neighborhood services. Childcare guidance is provided separately as an informational parent resource.',
  alternates:{canonical:'/local-services'},
  openGraph:{type:'website',url:'/local-services',title:'Local Services in Central Illinois',description:'Find independent neighborhood service providers across Central Illinois.'},
}
export default function Page(){return <VerticalPage vertical="other" title="Local Services" description="Discover independent neighborhood service providers including pet services, auto detailing, recycling and other locally operated businesses. Childcare is kept separate as an informational parent resource rather than a provider-matching directory."/>}
