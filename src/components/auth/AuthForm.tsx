import { useState, type FormEvent } from 'react'
import { FilePlus2 } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandHeader, DeveloperMark } from '../common/BrandHeader'
import { useAuth } from '../../features/auth/AuthProvider'
import { cognitoConfigured, confirmPasswordReset, requestPasswordReset, signIn, type SignInResult } from '../../services/cognito/auth'

type Step = 'credentials' | 'newPassword' | 'resetCode'
type Completion = Extract<SignInResult, { status: 'newPasswordRequired' }>['complete']

export function AuthForm({ mode }: { mode: 'login' | 'forgot' }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<Step>('credentials'); const [complete, setComplete] = useState<Completion | null>(null)
  const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); const destination = (location.state as { from?: string } | null)?.from || '/dashboard'
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'forgot' && step === 'credentials') { await requestPasswordReset(email); setStep('resetCode'); setMessage('A verification code was sent to your email.'); return }
      if (mode === 'forgot') { await confirmPasswordReset(email, code, password); setMessage('Password updated. You can sign in now.'); navigate('/login', { replace: true }); return }
      if (step === 'newPassword' && complete) { await complete(password); await auth.refresh(); navigate(destination, { replace: true }); return }
      const result = await signIn(email, password)
      if (result.status === 'newPasswordRequired') { setComplete(() => result.complete); setPassword(''); setStep('newPassword'); setMessage('Choose a new password to finish setting up your account.'); return }
      await auth.refresh(); navigate(destination, { replace: true })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.') } finally { setBusy(false) }
  }
  const needsPassword = mode === 'login' || step !== 'credentials'
  const title = mode === 'forgot' ? 'Reset password' : step === 'newPassword' ? 'Set a new password' : 'Sign in'
  const label = busy ? 'Please wait…' : mode === 'forgot' ? (step === 'credentials' ? 'Send code' : 'Update password') : step === 'newPassword' ? 'Set password' : 'Sign in'
  // An already signed-in visitor never needs the sign-in form.
  if (mode === 'login' && auth.user && !auth.loading && step === 'credentials') return <Navigate to={destination} replace />
  return <main className="auth-page"><BrandHeader /><form className="auth-card" onSubmit={submit}><h1>{title}</h1><p>Guest payment creation remains available without an account.</p>{!cognitoConfigured && <p className="auth-warning" role="status">Cloud features are not configured. Continue in guest mode.</p>}
    <label>Email or username<input type="text" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={step === 'newPassword'} value={email} onChange={event => setEmail(event.target.value)} /></label>
    {mode === 'forgot' && step === 'resetCode' && <label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} /></label>}
    {needsPassword && <label>{step === 'credentials' ? 'Password' : 'New password'}<input type="password" required minLength={8} autoComplete={step === 'credentials' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>}
    <button className="button primary" disabled={busy || !cognitoConfigured}>{label}</button>{message && <p role="status">{message}</p>}
    <nav>{mode === 'forgot' ? <Link to="/login">Sign in</Link> : <Link to="/forgot-password">Forgot password?</Link>}<Link to="/plans">Compare plans</Link></nav><Link className="button secondary guest-link" to="/guest">Continue as guest</Link></form><DeveloperMark /></main>
}
