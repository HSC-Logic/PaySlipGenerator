import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, supabaseConfigured } from '../../services/supabase/client'
import { normalizePlan, type Plan } from './entitlements'

type AuthState = { configured: boolean; loading: boolean; session: Session | null; user: User | null; plan: Plan; signOut: () => Promise<void> }
const AuthContext = createContext<AuthState>({ configured: false, loading: false, session: null, user: null, plan: 'free', signOut: async () => undefined })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(supabaseConfigured)
  useEffect(() => {
    if (!supabase) return setLoading(false)
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setLoading(false) } })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) { setSession(next); setLoading(false) } })
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [])
  useEffect(() => { if (!supabase || !session?.user) return setPlan('free'); void supabase.from('profiles').select('plan').eq('id', session.user.id).maybeSingle().then(({ data }) => setPlan(normalizePlan(data?.plan))) }, [session])
  const value = useMemo<AuthState>(() => ({ configured: supabaseConfigured, loading, session, user: session?.user ?? null, plan, signOut: async () => { if (supabase) await supabase.auth.signOut() } }), [loading, plan, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
