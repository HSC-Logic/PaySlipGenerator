import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cognitoConfigured, currentSession, isLapsed, planFromSession, signOut as cognitoSignOut, userFromSession, type AuthUser } from '../../services/cognito/auth'
import { onProRequired } from '../../services/api/client'
import { cloudDataEnabled } from '../../services/cloud'
import { clearLogoCache } from '../../services/logos'
import type { Plan } from './entitlements'

type AuthState = {
  configured: boolean; loading: boolean; user: AuthUser | null; plan: Plan
  /** Token carries `slipy-lapsed` (and not `slipy-pro`): the Pro plan ended. */
  lapsed: boolean
  /** The cloud API is configured, the user is signed in with `slipy-pro` and the server has not rejected that. */
  cloudAccess: boolean
  /** Re-reads the stored session; call after sign-in. */
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthState>({ configured: false, loading: false, user: null, plan: 'free', lapsed: false, cloudAccess: false, refresh: async () => undefined, signOut: async () => undefined })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [plan, setPlan] = useState<Plan>('free')
  const [lapsed, setLapsed] = useState(false)
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(cognitoConfigured)
  const refresh = async () => {
    const session = await currentSession()
    setUser(session ? userFromSession(session) : null)
    setPlan(planFromSession(session))
    setLapsed(isLapsed(session))
    setDenied(false)
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])
  // A 403 pro-required (for example a token issued before a downgrade) shows the same upgrade panel as a Free account.
  useEffect(() => onProRequired(() => setDenied(true)), [])
  const value = useMemo<AuthState>(() => ({
    configured: cognitoConfigured, loading, user, plan, lapsed, cloudAccess: cloudDataEnabled && user !== null && plan === 'pro' && !denied, refresh,
    signOut: async () => { cognitoSignOut(); clearLogoCache(); setUser(null); setPlan('free'); setLapsed(false); setDenied(false) },
  }), [denied, lapsed, loading, plan, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
