import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cognitoConfigured, currentSession, planFromSession, signOut as cognitoSignOut, userFromSession, type AuthUser } from '../../services/cognito/auth'
import type { Plan } from './entitlements'

type AuthState = {
  configured: boolean; loading: boolean; user: AuthUser | null; plan: Plan
  /** Re-reads the stored session; call after sign-in. */
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthState>({ configured: false, loading: false, user: null, plan: 'free', refresh: async () => undefined, signOut: async () => undefined })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(cognitoConfigured)
  const refresh = async () => {
    const session = await currentSession()
    setUser(session ? userFromSession(session) : null)
    setPlan(planFromSession(session))
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])
  const value = useMemo<AuthState>(() => ({
    configured: cognitoConfigured, loading, user, plan, refresh,
    signOut: async () => { cognitoSignOut(); setUser(null); setPlan('free') },
  }), [loading, plan, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
