import type { PaymentSlip } from '../types'
import { hasUnsavedChanges } from './dirtyState'
import { clearRecovery, loadRecovery, saveRecovery, type RecoverySnapshot } from './storage'

export const loadMeaningfulRecovery = (storage: Storage, defaults: PaymentSlip): RecoverySnapshot | null => {
  const recovery = loadRecovery(storage, defaults)
  return recovery && hasUnsavedChanges(recovery.slip, recovery.baseline) ? recovery : null
}

export const persistRecoveryState = (storage: Storage, slip: PaymentSlip, baseline: PaymentSlip) => hasUnsavedChanges(slip, baseline)
  ? saveRecovery(storage, slip, baseline)
  : clearRecovery(storage)
