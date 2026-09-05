import './email-lab.css'
import './templates.css'

export default function EmailDripLayout({children}:{children:React.ReactNode}){
  return <>
    <nav className="email-lab-nav" aria-label="Email campaign tools">
      <a href="/admin/email-drips">Campaign Studio</a>
      <a href="/admin/email-drips/templates">Template Library</a>
      <a href="/admin/email-drips/preview">Preview & Test Lab</a>
      <a href="/admin/email-drips/conversions">Conversion Dashboard</a>
    </nav>
    {children}
  </>
}
