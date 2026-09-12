// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkspaceTools, type WorkspaceToolId } from './WorkspaceTools'

afterEach(cleanup)

function Harness() {
  const [active, setActive] = useState<WorkspaceToolId>('history')
  return <WorkspaceTools active={active} onChange={setActive} panels={{ history: 'History content', drive: 'Drive content', settings: 'Settings content', privacy: 'Privacy content' }} />
}

describe('WorkspaceTools', () => {
  it('shows one panel at a time and supports keyboard tab navigation', () => {
    render(<Harness />)
    expect(screen.getByRole('tabpanel', { name: 'Payment history' }).hasAttribute('hidden')).toBe(false)
    fireEvent.click(screen.getByRole('tab', { name: 'Google Drive' }))
    expect(screen.getByRole('tabpanel', { name: 'Google Drive' }).hasAttribute('hidden')).toBe(false)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Google Drive' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Settings' }).getAttribute('aria-selected')).toBe('true')
  })
})
