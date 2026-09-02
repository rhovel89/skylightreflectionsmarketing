import type { Metadata } from 'next'
import { VerticalPage } from '@/components/VerticalPage'

export const dynamic='force-dynamic'
export const metadata:Metadata={
  title:'Local Services in Central Illinois',
  description:'Find independent local service providers across Central Illinois, including pet groomers, mobile pet groomers, childcare providers and other neighborhood services.',
  alternates:{canonical:'/local-services'},
  openGraph:{type:'website',url:'/local-services',title:'Local Services in Central Illinois',description:'Find independent neighborhood service providers across Central Illinois.'},
}
export default function Page(){return <VerticalPage vertical="other" title="Local Services" description="Discover independent neighborhood service providers, including pet grooming, mobile services, childcare and other locally operated businesses."/>}
