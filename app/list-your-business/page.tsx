import { redirect } from 'next/navigation'

export default function Page(){
  redirect('/contact?reason=list-business')
}
