import type { PaymentSlip } from '../types'

// Payment slips contain JSON-compatible data only. Serializing the complete model
// keeps dirty detection aligned with everything that can affect preview/PDF output.
const serializeSlip = (slip: PaymentSlip) => JSON.stringify(slip)

export const copySlip = (slip: PaymentSlip): PaymentSlip => JSON.parse(serializeSlip(slip)) as PaymentSlip

export const hasUnsavedChanges = (current: PaymentSlip, baseline: PaymentSlip) => serializeSlip(current) !== serializeSlip(baseline)

type ReplacementOptions = {
  current: PaymentSlip
  baseline: PaymentSlip
  confirmDiscard: () => boolean
  createReplacement: () => PaymentSlip
}

/** Returns null when a destructive replacement is cancelled.
 * The replacement factory is deliberately lazy so reference numbers and IDs are
 * not consumed until the user has agreed to discard their changes.
 */
export const prepareDestructiveReplacement = ({ current, baseline, confirmDiscard, createReplacement }: ReplacementOptions): PaymentSlip | null => {
  if (hasUnsavedChanges(current, baseline) && !confirmDiscard()) return null
  return createReplacement()
}
