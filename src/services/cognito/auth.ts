import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js'
import type { Plan } from '../../features/auth/entitlements'

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim()
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim()

export const cognitoConfigured = Boolean(userPoolId && clientId)
const pool = cognitoConfigured ? new CognitoUserPool({ UserPoolId: userPoolId!, ClientId: clientId! }) : null

export const PRO_GROUP = 'slipy-pro'
export const LAPSED_GROUP = 'slipy-lapsed'

export type AuthUser = { id: string; email: string }
export type SignInResult =
  | { status: 'signedIn'; session: CognitoUserSession }
  | { status: 'newPasswordRequired'; complete: (newPassword: string) => Promise<CognitoUserSession> }

const requirePool = () => {
  if (!pool) throw new Error('Sign-in is not configured. Guest mode remains available.')
  return pool
}
const cognitoUser = (email: string) => new CognitoUser({ Username: email.trim(), Pool: requirePool() })
const asError = (error: unknown) => error instanceof Error ? error : new Error('Authentication failed. Please try again.')

const groups = (session: CognitoUserSession | null): string[] => {
  const value = session?.getAccessToken().payload['cognito:groups']
  return Array.isArray(value) ? value.filter((group): group is string => typeof group === 'string') : []
}
export const planFromGroups = (value: unknown): Plan => Array.isArray(value) && value.includes(PRO_GROUP) ? 'pro' : 'free'
export const planFromSession = (session: CognitoUserSession | null): Plan => planFromGroups(groups(session))
export const isLapsed = (session: CognitoUserSession | null) => groups(session).includes(LAPSED_GROUP) && !groups(session).includes(PRO_GROUP)

export const userFromSession = (session: CognitoUserSession): AuthUser => {
  const payload = session.getIdToken().payload
  return { id: String(payload.sub), email: String(payload.email ?? '') }
}

const authenticate = (user: CognitoUser, details: AuthenticationDetails) =>
  new Promise<SignInResult>((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: session => resolve({ status: 'signedIn', session }),
      onFailure: error => reject(asError(error)),
      newPasswordRequired: () => resolve({
        status: 'newPasswordRequired',
        complete: newPassword => new Promise<CognitoUserSession>((done, fail) => user.completeNewPasswordChallenge(newPassword, {}, {
          onSuccess: done,
          onFailure: error => fail(asError(error)),
        })),
      }),
    })
  })

export const signIn = (email: string, password: string) =>
  authenticate(cognitoUser(email), new AuthenticationDetails({ Username: email.trim(), Password: password }))

/** Returns the stored session, refreshing it with the refresh token when the access token has expired. */
export const currentSession = () => new Promise<CognitoUserSession | null>(resolve => {
  const user = pool?.getCurrentUser()
  if (!user) return resolve(null)
  user.getSession((error: Error | null, session: CognitoUserSession | null) => resolve(error || !session?.isValid() ? null : session))
})

export const getAccessToken = async () => {
  const session = await currentSession()
  if (!session) throw new Error('Your session expired. Sign in again.')
  return session.getAccessToken().getJwtToken()
}

export type AccessContext = { token: string; pro: boolean; lapsed: boolean }
/** Access token plus the plan groups it carries, so callers can refuse to hit the API without `slipy-pro`. */
export const getAccessContext = async (): Promise<AccessContext> => {
  const session = await currentSession()
  if (!session) throw new Error('Your session expired. Sign in again.')
  return { token: session.getAccessToken().getJwtToken(), pro: planFromSession(session) === 'pro', lapsed: isLapsed(session) }
}

export const signOut = () => pool?.getCurrentUser()?.signOut()

export const requestPasswordReset = (email: string) => new Promise<void>((resolve, reject) =>
  cognitoUser(email).forgotPassword({ onSuccess: () => resolve(), onFailure: error => reject(asError(error)) }))

export const confirmPasswordReset = (email: string, code: string, newPassword: string) => new Promise<void>((resolve, reject) =>
  cognitoUser(email).confirmPassword(code.trim(), newPassword, { onSuccess: () => resolve(), onFailure: error => reject(asError(error)) }))
