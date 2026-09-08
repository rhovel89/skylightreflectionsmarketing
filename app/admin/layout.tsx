import './admin-shell.css'
import './dashboard.css'
import './section-ui.css'
import './workflow-ui.css'
import './specialized-ui.css'
import './business-workspace.css'
import './action-center.css'
import './admin-productivity.css'
import './admin-unified-ui.css'
import './admin-workflow-guide.css'
import './admin-focus-mode.css'
import './admin-guided-actions.css'
import './admin-form-assistant.css'
import './admin-owner-command.css'
import { requireStaff } from '@/lib/auth'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminTopbar } from '@/components/AdminTopbar'
import { AdminWorkspaceNav } from '@/components/AdminWorkspaceNav'
import { AdminWorkflowGuide } from '@/components/AdminWorkflowGuide'
import { AdminGuidedActions } from '@/components/AdminGuidedActions'
import { AdminFormAssistant } from '@/components/AdminFormAssistant'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireStaff('/admin')

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-content-shell">
        <AdminTopbar />
        <AdminWorkspaceNav />
        <AdminWorkflowGuide />
        <AdminGuidedActions />
        <main className="admin-main">{children}</main>
        <AdminFormAssistant />
      </div>
    </div>
  )
}
