// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const auth = { loading: false, user: null as { id: string } | null }
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => auth }))
const { HomeRedirect } = await import('./HomeRedirect')
afterEach(cleanup)

const renderRoot = () => render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<HomeRedirect />} /><Route path="/dashboard" element={<p>dashboard</p>} /><Route path="/login" element={<p>login</p>} /></Routes></MemoryRouter>)

describe('HomeRedirect', () => {
  it('sends a restored session to the dashboard', () => { auth.loading = false; auth.user = { id: 'u1' }; renderRoot(); expect(screen.getByText('dashboard')).toBeTruthy() })
  it('sends a signed-out visitor to sign in', () => { auth.loading = false; auth.user = null; renderRoot(); expect(screen.getByText('login')).toBeTruthy() })
  it('waits while the session is restored', () => { auth.loading = true; auth.user = null; renderRoot(); expect(screen.getByRole('status').textContent).toMatch(/Restoring/) })
})
