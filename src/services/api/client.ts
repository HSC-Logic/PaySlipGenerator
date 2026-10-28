import { getAccessToken } from '../cognito/auth'

const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '')
export const apiConfigured = Boolean(base)

const PROBLEM_BASE = 'https://slipy.hsclogic.link/problems/'
export type ProblemKind = 'unauthorized' | 'pro-required' | 'rate-limited' | 'temporarily-unavailable' | 'unknown'

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly kind: ProblemKind, readonly retryAfterSeconds?: number) { super(message) }
}

const kindOf = (type: unknown): ProblemKind => {
  const slug = typeof type === 'string' && type.startsWith(PROBLEM_BASE) ? type.slice(PROBLEM_BASE.length) : ''
  return slug === 'unauthorized' || slug === 'pro-required' || slug === 'rate-limited' || slug === 'temporarily-unavailable' ? slug : 'unknown'
}

/** Maps an RFC 9457 problem response (or any failed response) to an ApiError. */
export const toApiError = async (response: Response): Promise<ApiError> => {
  let body: { type?: unknown; detail?: unknown; title?: unknown } = {}
  try { body = await response.json() } catch { /* non-JSON error body */ }
  const retryAfter = Number(response.headers.get('Retry-After'))
  const message = [body.detail, body.title].find((value): value is string => typeof value === 'string' && value.length > 0) ?? `Request failed (${response.status}).`
  return new ApiError(message, response.status, kindOf(body.type), Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined)
}

export async function apiFetch<T>(path: string, init: RequestInit & { authenticated?: boolean } = {}): Promise<T> {
  if (!base) throw new Error('Cloud features are not configured. Guest mode remains available.')
  const { authenticated = true, headers, ...rest } = init
  const merged = new Headers(headers)
  merged.set('Accept', 'application/json')
  if (authenticated) merged.set('Authorization', `Bearer ${await getAccessToken()}`)
  if (rest.body && !merged.has('Content-Type')) merged.set('Content-Type', 'application/json')
  const response = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, { ...rest, headers: merged })
  if (!response.ok) throw await toApiError(response)
  return response.status === 204 ? (undefined as T) : await response.json() as T
}

export type Me = { id: string; plan: string }
export const fetchMe = () => apiFetch<Me>('/me')
export const fetchHealth = () => apiFetch<{ status: string }>('/health', { authenticated: false })
