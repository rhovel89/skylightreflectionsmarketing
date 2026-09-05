import './email-lab.css'

export default function EmailDripLayout({children}:{children:React.ReactNode}){
  return <>
    <nav className="email-lab-nav" aria-label="Email campaign tools">
      <a href="/admin/email-drips">Campaign Studio</a>
      <a href="/admin/email-drips/preview">Preview & Test Lab</a>
      <a href="/admin/email-drips/conversions">Conversion Dashboard</a>
    </nav>
    {children}
  </>
}
