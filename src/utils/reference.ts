const STATE_KEY = 'payment-slip-reference-state-v1'
const ACTIVE_KEY = 'payment-slip-active-reference'
const legacySequenceKey = (year: number) => `payment-slip-sequence-${year}`

type ReferenceState = { version: 1; years: Record<string, { last: number; issued: string[] }> }
type ReferenceOptions = { year?: number; storage?: Storage; session?: Storage; existingReferences?: string[] }

export const nextReference = (year: number, sequence: number) => `PS-${year}-${String(sequence).padStart(4, '0')}`

export const parseReference = (reference: string) => {
  const match = /^PS-(\d{4})-(\d+)$/.exec(reference.trim())
  return match ? { year: Number(match[1]), sequence: Number(match[2]) } : null
}

const readState = (storage: Storage): ReferenceState => {
  const parsed = safeParse(safeGet(storage, STATE_KEY))
  if (isRecord(parsed) && parsed.version === 1 && isRecord(parsed.years)) {
    const years: ReferenceState['years'] = {}
    for (const [year, value] of Object.entries(parsed.years)) {
      if (!/^\d{4}$/.test(year) || !isRecord(value) || typeof value.last !== 'number' || !Number.isFinite(value.last) || !Array.isArray(value.issued) || !value.issued.every(item => typeof item === 'string')) continue
      years[year] = { last: Math.max(0, Math.floor(value.last)), issued: value.issued }
    }
    return { version: 1, years }
  }
  return { version: 1, years: {} }
}

export const reserveNextReference = ({ year = new Date().getFullYear(), storage = localStorage, existingReferences = [] }: ReferenceOptions = {}) => {
  const state = readState(storage)
  const record = state.years[String(year)] || { last: 0, issued: [] }
  const known = new Set([...record.issued, ...existingReferences].map(value => value.trim()).filter(Boolean))
  const knownSequences = [...known].map(parseReference).filter(value => value?.year === year).map(value => value!.sequence)
  const legacySequence = Number(safeGet(storage, legacySequenceKey(year)) || 0)
  let sequence = Math.max(0, Number.isFinite(record.last) ? record.last : 0, Number.isFinite(legacySequence) ? legacySequence : 0, ...knownSequences) + 1
  let reference = nextReference(year, sequence)
  while (known.has(reference)) { sequence += 1; reference = nextReference(year, sequence) }
  state.years[String(year)] = { last: sequence, issued: [...new Set([...record.issued, reference])] }
  safeSet(storage, STATE_KEY, JSON.stringify(state))
  return reference
}

export const currentOrNextReference = (options: ReferenceOptions = {}) => {
  const year = options.year ?? new Date().getFullYear()
  const session = options.session ?? sessionStorage
  const active = safeGet(session, ACTIVE_KEY) || ''
  if (parseReference(active)?.year === year) return active
  const reference = reserveNextReference({ ...options, year })
  safeSet(session, ACTIVE_KEY, reference)
  return reference
}

export const startNewReference = (options: ReferenceOptions = {}) => {
  const year = options.year ?? new Date().getFullYear()
  const session = options.session ?? sessionStorage
  const reference = reserveNextReference({ ...options, year })
  safeSet(session, ACTIVE_KEY, reference)
  return reference
}

export const generateReference = (options: ReferenceOptions = {}) => startNewReference(options)
import { isRecord, safeGet, safeParse, safeSet } from './storage'
