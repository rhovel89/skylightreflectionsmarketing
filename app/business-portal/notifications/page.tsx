import { getOwnerData } from '@/lib/owner'
import { TENANT_ID } from '@/lib/constants'
import { OwnerNotificationCenter } from '@/components/OwnerNotificationCenter'

export default async function Page(){
 const{claims,s}=await getOwnerData('/business-portal/notifications')
 const userId=String(claims.sub)
 const{data,error}=await s.from('notifications').select('id,title,body,action_url,read_at,created_at,event_key').eq('tenant_id',TENANT_ID).eq('user_id',userId).order('created_at',{ascending:false}).limit(100)
 const items=(data??[]) as any[]
 const unread=items.filter(x=>!x.read_at).length
 return <div>
  <div className="portal-section-head"><div><div className="kpi">Account Updates</div><h2>Notifications</h2><p className="muted">Keep up with business-account, lead, billing and protected workflow updates. Notification read state is private to your account.</p></div><span className={`badge ${unread?'sponsored':'neutral'}`}>{unread} unread</span></div>
  {error?<div className="notice warn">Notifications could not be loaded completely: {error.message}</div>:<OwnerNotificationCenter initialItems={items}/>} 
 </div>
}
