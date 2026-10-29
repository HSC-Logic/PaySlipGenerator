import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
export function CloudShell() { const auth = useAuth(); const navigate = useNavigate(); const { pathname } = useLocation(); const nav = useRef<HTMLElement>(null)
  useEffect(() => { nav.current?.querySelector('a.active')?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [pathname])
  return <div className="cloud-shell"><header><NavLink to="/" className="cloud-brand">Sliply</NavLink><nav ref={nav} aria-label="Cloud navigation"><NavLink to="/dashboard">Dashboard</NavLink><NavLink to="/payments">Payments</NavLink><NavLink to="/companies">Companies</NavLink><NavLink to="/recipients">Recipients</NavLink><NavLink to="/settings">Settings</NavLink></nav><div className="account-menu"><span title={auth.user?.email}>{auth.user?.email}</span><button className="button secondary" onClick={() => void auth.signOut().then(() => navigate('/'))}>Sign out</button></div></header><Outlet /></div> }
