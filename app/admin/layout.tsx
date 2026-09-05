import './admin-shell.css'
import './dashboard.css'
import './section-ui.css'
import './workflow-ui.css'
import './specialized-ui.css'
import './business-workspace.css'
import { requireStaff } from '@/lib/auth'
import { AdminSidebar } from '@/components/AdminSidebar'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireStaff('/admin')

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">{children}</main>
    </div>
  )
}
