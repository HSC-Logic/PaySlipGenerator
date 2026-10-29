// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AuthForm } from './AuthForm'

afterEach(cleanup)

describe('AuthForm identifier field', () => {
  it.each(['login', 'forgot'] as const)('accepts a username as well as an email on %s', mode => {
    render(<MemoryRouter><AuthProvider><AuthForm mode={mode} /></AuthProvider></MemoryRouter>)
    const field = screen.getByLabelText('Email or username') as HTMLInputElement
    expect(field.type).toBe('text')
    expect(field.autocomplete).toBe('username')
  })
})
