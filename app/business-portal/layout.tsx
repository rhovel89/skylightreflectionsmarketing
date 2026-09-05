import './portal-shell.css'
import './portal-notifications.css'
import './portal-workflows.css'
import './portal-leads.css'
import './portal-billing.css'
import './portal-analytics.css'
import { SiteShell } from '@/components/SiteShell'
import { requireUser } from '@/lib/auth'
import { OwnerPortalSidebar } from '@/components/OwnerPortalSidebar'

export const dynamic='force-dynamic'
export const metadata={robots:{index:false,follow:false}}

export default async function Layout({children}:{children:React.ReactNode}){
 await requireUser('/business-portal')
 return <SiteShell><main className="owner-portal-shell">
  <section className="owner-portal-hero"><div className="container owner-portal-hero-inner"><div><div className="crumb">Private Business Workspace</div><h1>Business Portal</h1><p>Manage accurate business information, customer opportunities, billing, performance and optional growth products from one protected workspace.</p></div><div className="owner-portal-hero-badge"><span>Portal principle</span><strong>Paid products never buy organic rank</strong></div></div></section>
  <section className="owner-portal-section"><div className="container owner-portal-layout"><OwnerPortalSidebar/><div className="owner-portal-main">{children}</div></div></section>
 </main></SiteShell>
}
