export type BusinessPlanAccess = {
  effective_plan_id?: string | null
  effective_plan_slug: string
  effective_plan_name: string
  effective_entitlements: Record<string, unknown>
  access_source: 'admin_trial' | 'admin_complimentary' | 'paid_subscription' | 'free' | string
  base_plan_id?: string | null
  base_plan_slug: string
  base_plan_name: string
  base_subscription_id?: string | null
  base_subscription_status?: string | null
  base_subscription_ends_at?: string | null
  grant_id?: string | null
  grant_plan_id?: string | null
  grant_plan_slug?: string | null
  grant_plan_name?: string | null
  grant_kind?: 'trial' | 'permanent' | null
  grant_starts_on?: string | null
  grant_ends_on?: string | null
  grant_state?: 'none' | 'scheduled' | 'active' | 'expired' | string
  grant_applied?: boolean
  grant_note?: string | null
}

const fallback: BusinessPlanAccess = {
  effective_plan_slug: 'free',
  effective_plan_name: 'Free',
  effective_entitlements: {},
  access_source: 'free',
  base_plan_slug: 'free',
  base_plan_name: 'Free',
  grant_state: 'none',
  grant_applied: false,
}

export async function getBusinessPlanAccess(s: any, businessId: string): Promise<BusinessPlanAccess> {
  const { data, error } = await s.rpc('get_business_plan_access', { p_business_id: businessId })
  if (error) throw new Error(error.message)
  return { ...fallback, ...((data ?? {}) as BusinessPlanAccess) }
}

export function effectivePlanIs(access: BusinessPlanAccess, ...slugs: string[]) {
  return slugs.includes(String(access.effective_plan_slug || 'free'))
}

export function effectiveEntitlement(access: BusinessPlanAccess, key: string) {
  return access.effective_entitlements?.[key]
}
