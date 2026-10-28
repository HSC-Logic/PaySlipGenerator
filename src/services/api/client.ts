import { getAccessContext } from '../cognito/auth'

const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '')
export const apiConfigured = Boolean(base)

const PROBLEM_BASE = 'https://slipy.hsclogic.link/problems/'
const KINDS = [
  'unauthorized', 'pro-required', 'rate-limited', 'temporarily-unavailable', 'reference-taken', 'data-archived', 'conflict', 'name-taken', 'validation', 'not-found',
  'drive-not-configured', 'drive-not-connected', 'drive-reconnect-required', 'drive-code-rejected', 'drive-folder-not-found', 'drive-unavailable', 'drive-invalid-request',
] as const
export type ProblemKind = typeof KINDS[number] | 'unknown'

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly kind: ProblemKind, readonly retryAfterSeconds?: number, readonly fieldErrors?: Record<string, string[]>) { super(message) }
}

const kindOf = (type: unknown, status: number): ProblemKind => {
  const slug = typeof type === 'string' && type.startsWith(PROBLEM_BASE) ? type.slice(PROBLEM_BASE.length) : ''
  const known = KINDS.find(kind => kind === slug)
  return known ?? (status === 409 ? 'conflict' : status === 410 ? 'data-archived' : status === 404 ? 'not-found' : 'unknown')
}

const FIELD_WORDS: Record<string, string> = { referencePrefix: 'reference prefix', paidDate: 'paid date', logoId: 'logo', companyId: 'company', recipientId: 'recipient', defaultCurrency: 'default currency', themeColor: 'theme color' }
const humanize = (word: string) => FIELD_WORDS[word] ?? word.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
/** Turns a server field path such as `slip.items[0].quantity` into words such as "Item 1 quantity". */
export const describeField = (key: string) => {
  const parts = key.replace(/^slip\./, '').split('.').filter(Boolean)
  const words = parts.map(part => {
    const indexed = /^([A-Za-z]+)\[(\d+)\]$/.exec(part)
    if (!indexed) return humanize(part)
    const noun = indexed[1] === 'items' ? 'item' : indexed[1] === 'adjustments' ? 'adjustment' : humanize(indexed[1])
    return `${noun} ${Number(indexed[2]) + 1}`
  })
  const text = words.join(' ') || 'request'
  return text[0].toUpperCase() + text.slice(1)
}
const validationMessage = (errors: Record<string, string[]>) => {
  const lines = Object.entries(errors).flatMap(([key, messages]) => messages.map(message => `${describeField(key)}: ${message}`))
  return lines.length ? `Please correct the following. ${lines.slice(0, 3).join(' ')}${lines.length > 3 ? ` (and ${lines.length - 3} more)` : ''}` : 'The server rejected some of the values. Check them and try again.'
}
const fieldErrorsOf = (value: unknown): Record<string, string[]> | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const entries = Object.entries(value as Record<string, unknown>).map(([key, messages]) => [key, (Array.isArray(messages) ? messages : [messages]).filter((message): message is string => typeof message === 'string' && message.length > 0)] as const).filter(([, messages]) => messages.length)
  return entries.length ? Object.fromEntries(entries) : undefined
}

const FIXED_MESSAGES: Partial<Record<ProblemKind, string>> = {
  conflict: 'This record was changed on another device or tab. Reload it and try again.',
  'name-taken': 'A design with this name already exists. Choose a different name.',
  'not-found': 'That item no longer exists, or it belongs to another account.',
  'drive-not-configured': 'Google Drive is not available on this server yet. Try again later.',
  'drive-not-connected': 'Google Drive is not connected. Connect it and try again.',
  'drive-reconnect-required': 'Google Drive access expired or was revoked. Reconnect Google Drive to continue.',
  'drive-code-rejected': 'Google did not accept the authorization. Start the connection again.',
  'drive-folder-not-found': 'That Drive folder no longer exists or is not accessible. Choose another folder.',
  'drive-unavailable': 'Google Drive is temporarily unavailable. Try again in a moment.',
}

/** Maps an RFC 9457 problem response (or any failed response) to an ApiError. */
export const toApiError = async (response: Response): Promise<ApiError> => {
  let body: { type?: unknown; detail?: unknown; title?: unknown; errors?: unknown } = {}
  try { body = await response.json() } catch { /* non-JSON error body */ }
  const retryAfter = Number(response.headers.get('Retry-After'))
  const kind = kindOf(body.type, response.status)
  const fieldErrors = kind === 'validation' ? fieldErrorsOf(body.errors) : undefined
  const message = kind === 'validation' ? validationMessage(fieldErrors ?? {})
    : FIXED_MESSAGES[kind] ?? [body.detail, body.title].find((value): value is string => typeof value === 'string' && value.length > 0) ?? `Request failed (${response.status}).`
  return new ApiError(message, response.status, kind, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined, fieldErrors)
}

export const isProRequired = (error: unknown) => error instanceof ApiError && error.kind === 'pro-required'

const proRequiredListeners = new Set<() => void>()
/** Lets the auth layer react when the server rejects a token for lacking `slipy-pro` (for example after a downgrade). */
export const onProRequired = (listener: () => void) => { proRequiredListeners.add(listener); return () => { proRequiredListeners.delete(listener) } }
const proRequired = (message = 'Slipy Pro is required.') => { proRequiredListeners.forEach(listener => listener()); return new ApiError(message, 403, 'pro-required') }

type ApiInit = RequestInit & { authenticated?: boolean; allowLapsed?: boolean }

async function send(path: string, init: ApiInit, accept: string): Promise<Response> {
  if (!base) throw new Error('Cloud features are not configured. Browser-only mode remains available.')
  const { authenticated = true, allowLapsed = false, headers, ...rest } = init
  const merged = new Headers(headers)
  merged.set('Accept', accept)
  if (authenticated) {
    const access = await getAccessContext()
    // Never reach the API without slipy-pro (only the export also accepts slipy-lapsed): the server would reject it anyway.
    if (!access.pro && !(allowLapsed && access.lapsed)) throw proRequired()
    merged.set('Authorization', `Bearer ${access.token}`)
  }
  if (typeof rest.body === 'string' && !merged.has('Content-Type')) merged.set('Content-Type', 'application/json')
  const response = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, { ...rest, headers: merged })
  if (!response.ok) {
    const error = await toApiError(response)
    if (error.kind === 'pro-required') proRequiredListeners.forEach(listener => listener())
    throw error
  }
  return response
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const response = await send(path, init, 'application/json')
  return response.status === 204 ? (undefined as T) : await response.json() as T
}

/** Fetches a binary or file response (logo bytes, account export) with the bearer token. */
export async function apiDownload(path: string, init: ApiInit = {}): Promise<{ blob: Blob; filename: string }> {
  const response = await send(path, init, '*/*')
  const disposition = response.headers.get('Content-Disposition') ?? ''
  return { blob: await response.blob(), filename: /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? '' }
}

export type MeArchive = { createdAt: string }
export type Me = { id: string; plan: string; archives?: MeArchive[] }
export const fetchMe = () => apiFetch<Me>('/me')
export const fetchHealth = () => apiFetch<{ status: string }>('/health', { authenticated: false })
