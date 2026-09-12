// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppRoutes } from './AppRoutes'
afterEach(()=>{cleanup();window.location.hash=''})
describe('application routes without cloud configuration',()=>{
  it('keeps guest creation available',()=>{window.location.hash='#/';render(<AppRoutes/>);expect(screen.getByText('Create a quick payment slip')).toBeTruthy()})
  it('shows the public Free and Pro comparison page',()=>{window.location.hash='#/plans';render(<AppRoutes/>);expect(screen.getByRole('heading',{name:'Choose what fits your workflow'})).toBeTruthy();expect(screen.getByRole('table')).toBeTruthy();expect(screen.getByRole('link',{name:'Email HSC Logic for Pro'}).getAttribute('href')).toContain('mailto:info@hsclogic.com')})
  it('redirects a protected cloud route to login',async()=>{window.location.hash='#/dashboard';render(<AppRoutes/>);await waitFor(()=>expect(screen.getByRole('heading',{name:'Sign in'})).toBeTruthy());expect(screen.getByText('Cloud features are not configured. Continue in guest mode.')).toBeTruthy()})
})
