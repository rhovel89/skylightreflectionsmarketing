import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export async function getClaims() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) return null
  return data.claims
}
export async function requireUser(next = '/account') {
  const claims = await getClaims()
  if (!claims?.sub) redirect(`/login?next=${encodeURIComponent(next)}`)
  return claims
}
export async function getRoles(userId?: string) {
  const claims = userId ? { sub: userId } : await getClaims()
  if (!claims?.sub) return [] as string[]
  const supabase = await createClient()
  const { data } = await supabase.from('user_roles').select('role').eq('tenant_id', TENANT_ID).eq('user_id', claims.sub)
  return (data ?? []).map((r: {role:string}) => r.role)
}
export async function requireStaff(path = '/admin') {
  const claims = await requireUser(path)
  const roles = await getRoles(String(claims.sub))
  if (!roles.some((r) => ['staff','admin','super_admin'].includes(r))) redirect('/account?access=staff-required')
  return { claims, roles }
}
export async function requireAdmin(path = '/admin') {
  const claims = await requireUser(path)
  const roles = await getRoles(String(claims.sub))
  if (!roles.some((r) => ['admin','super_admin'].includes(r))) redirect('/admin?access=admin-required')
  return { claims, roles }
}

export async function requireSuperAdmin(path = '/admin/team') {
  const claims = await requireUser(path)
  const roles = await getRoles(String(claims.sub))
  if (!roles.includes('super_admin')) redirect('/admin?access=super-admin-required')
  return { claims, roles }
}
