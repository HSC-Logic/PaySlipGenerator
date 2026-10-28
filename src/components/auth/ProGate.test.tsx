// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_API_BASE_URL', 'https://api.test/api/v1')
vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-1_Test12345')
vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'client')
let auth = { user: { id: 'u1', email: 'a@b.c' } as { id: string; email: string } | null, plan: 'free', lapsed: false, cloudAccess: false }
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => auth }))
const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
const { ProGate } = await import('./ProGate')
const { CloudSettingsPage } = await import('../settings/CloudSettingsPage')
afterEach(() => { cleanup(); fetchMock.mockClear() })
const view = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>)

describe('Pro gating', () => {
  it('shows the upgrade panel for a Free account and never mounts the cloud screen', () => {
    auth = { user: { id: 'u1', email: 'a@b.c' }, plan: 'free', lapsed: false, cloudAccess: false }
    view(<ProGate><p>cloud content</p></ProGate>)
    expect(screen.queryByText('cloud content')).toBeNull(); expect(screen.getByRole('link', { name: 'See Slipy Pro' }).getAttribute('href')).toBe('/plans')
  })
  it('shows the lapsed notice for a lapsed account', () => {
    auth = { user: { id: 'u1', email: 'a@b.c' }, plan: 'free', lapsed: true, cloudAccess: false }
    view(<ProGate><p>cloud content</p></ProGate>)
    expect(screen.getByText(/Your Slipy Pro has ended/)).toBeTruthy(); expect(screen.getByRole('link', { name: 'Download my data' })).toBeTruthy()
  })
  it('renders the cloud screen for Pro', () => {
    auth = { user: { id: 'u1', email: 'a@b.c' }, plan: 'pro', lapsed: false, cloudAccess: true }
    view(<ProGate><p>cloud content</p></ProGate>); expect(screen.getByText('cloud content')).toBeTruthy()
  })
})

describe('account settings', () => {
  it('makes no API call for an account that was never Pro', () => {
    auth = { user: { id: 'u1', email: 'a@b.c' }, plan: 'free', lapsed: false, cloudAccess: false }
    view(<CloudSettingsPage />)
    expect(screen.getByRole('heading', { name: 'Cloud sync is a Slipy Pro feature' })).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Download my data' })).toBeNull(); expect(fetchMock).not.toHaveBeenCalled()
  })
  it('offers download and support-assisted deletion to a lapsed account without calling the API', () => {
    auth = { user: { id: 'u1', email: 'a@b.c' }, plan: 'free', lapsed: true, cloudAccess: false }
    view(<CloudSettingsPage />)
    expect(screen.getByRole('button', { name: 'Download my data' })).toBeTruthy(); expect(screen.getByRole('link', { name: 'Delete my Slipy data' }).getAttribute('href')).toContain('mailto:info@hsclogic.com'); expect(fetchMock).not.toHaveBeenCalled()
  })
})
