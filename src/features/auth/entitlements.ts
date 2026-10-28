export type Plan = 'free' | 'pro'
/** `cloud` covers sync, history, companies, recipients and designs on the Slipy API; the server enforces it too. */
export type Capability = 'cloud' | 'removeSliplyBranding' | 'googleDrive'
const matrix: Record<Plan, Record<Capability, boolean>> = {
  free: { cloud: false, removeSliplyBranding: false, googleDrive: false },
  pro: { cloud: true, removeSliplyBranding: true, googleDrive: true },
}
export const normalizePlan = (value: unknown): Plan => value === 'pro' ? 'pro' : 'free'
export const can = (plan: unknown, capability: Capability) => matrix[normalizePlan(plan)][capability]
export const showSliplyBranding = (plan: unknown, preference: boolean) => !can(plan, 'removeSliplyBranding') || preference
