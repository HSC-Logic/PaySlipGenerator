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
  try {
    const parsed = JSON.parse(storage.getItem(STATE_KEY) || '') as ReferenceState
    if (parsed?.version === 1 && parsed.years && typeof parsed.years === 'object') return parsed
  } catch { /* missing or malformed state starts safely below */ }
  return { version: 1, years: {} }
}

export const reserveNextReference = ({ year = new Date().getFullYear(), storage = localStorage, existingReferences = [] }: ReferenceOptions = {}) => {
  const state = readState(storage)
  const record = state.years[String(year)] || { last: 0, issued: [] }
  const known = new Set([...record.issued, ...existingReferences].map(value => value.trim()).filter(Boolean))
  const knownSequences = [...known].map(parseReference).filter(value => value?.year === year).map(value => value!.sequence)
  const legacySequence = Number(storage.getItem(legacySequenceKey(year)) || 0)
  let sequence = Math.max(0, Number.isFinite(record.last) ? record.last : 0, Number.isFinite(legacySequence) ? legacySequence : 0, ...knownSequences) + 1
  let reference = nextReference(year, sequence)
  while (known.has(reference)) { sequence += 1; reference = nextReference(year, sequence) }
  state.years[String(year)] = { last: sequence, issued: [...new Set([...record.issued, reference])] }
  storage.setItem(STATE_KEY, JSON.stringify(state))
  return reference
}

export const currentOrNextReference = (options: ReferenceOptions = {}) => {
  const year = options.year ?? new Date().getFullYear()
  const session = options.session ?? sessionStorage
  const active = session.getItem(ACTIVE_KEY) || ''
  if (parseReference(active)?.year === year) return active
  const reference = reserveNextReference({ ...options, year })
  session.setItem(ACTIVE_KEY, reference)
  return reference
}

export const startNewReference = (options: ReferenceOptions = {}) => {
  const year = options.year ?? new Date().getFullYear()
  const session = options.session ?? sessionStorage
  const reference = reserveNextReference({ ...options, year })
  session.setItem(ACTIVE_KEY, reference)
  return reference
}

export const generateReference = (options: ReferenceOptions = {}) => startNewReference(options)
