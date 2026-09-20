import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App'
import { logout } from '../../src/auth/authStore'

describe('Authentication flow', () => {
  beforeEach(() => {
    logout()
    window.history.pushState({}, '', '/')
  })

  it('shows the login screen when unauthenticated', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to PayScope' })).toBeInTheDocument()
    expect(screen.getByLabelText('Access token')).toBeInTheDocument()
  })

  it('does not render protected content while unauthenticated', () => {
    render(<App />)

    expect(screen.queryByRole('heading', { level: 1, name: 'PayScope' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('establishes authenticated state and shows protected content after entering a token', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Access token'), 'a-user-entered-token')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'PayScope' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it('requires a non-empty token and reports it as an accessible error', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your access token.')
    expect(screen.getByLabelText('Access token')).toHaveAttribute('aria-invalid', 'true')
  })

  it('returns to the login screen on sign out', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Access token'), 'a-user-entered-token')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { level: 1, name: 'PayScope' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in to PayScope' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })
})
