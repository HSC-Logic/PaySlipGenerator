import { STORAGE_KEYS, safeGet, safeSet } from '../../utils/storage'
const marker = 'sliply-cloud-import-v1'
export const localMigrationDecision = (storage: Storage): 'offer' | 'skip' => safeGet(storage, marker) || ![STORAGE_KEYS.company, STORAGE_KEYS.draft, STORAGE_KEYS.recovery].some(key => safeGet(storage, key)) ? 'skip' : 'offer'
export const rememberMigrationDecision = (storage: Storage, decision: 'imported' | 'skipped') => safeSet(storage, marker, decision)
