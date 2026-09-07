import Link from 'next/link'

export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{id:string}>}){
  const {id}=await params
  return <>
    <div className="admin-row-actions" style={{marginBottom:14,flexWrap:'wrap'}}>
      <Link className="btn btn-light" href={`/admin/businesses/${id}`}>Business Workspace</Link>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility`}>Google & SEO Visibility</Link>
    </div>
    {children}
  </>
}
