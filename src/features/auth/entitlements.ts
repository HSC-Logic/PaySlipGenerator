export type Plan = 'free' | 'pro'
export type Capability = 'cloudHistory' | 'multipleCompanies' | 'unlimitedRecipients' | 'customBranding' | 'removeSliplyBranding'
const matrix: Record<Plan, Record<Capability, boolean>> = {
  free: { cloudHistory: false, multipleCompanies: false, unlimitedRecipients: false, customBranding: false, removeSliplyBranding: false },
  pro: { cloudHistory: true, multipleCompanies: true, unlimitedRecipients: true, customBranding: true, removeSliplyBranding: true },
}
export const normalizePlan = (value: unknown): Plan => value === 'pro' ? 'pro' : 'free'
export const can = (plan: unknown, capability: Capability) => matrix[normalizePlan(plan)][capability]
export const showSliplyBranding = (plan: unknown, preference: boolean) => !can(plan, 'removeSliplyBranding') || preference
