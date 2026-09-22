import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import * as authApi from '../../src/api/auth'
import { ApiError } from '../../src/api/client'
import { logout } from '../../src/auth/authStore'

const emptyEmployeeListResponse = { items: [], page: 1, page_size: 20, total: 0, has_next: false }

const tokenResponse = { access_token: 'issued-access-token', token_type: 'bearer', expires_in: 3600 }

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/username or email/i), 'hr.admin')
  await user.type(screen.getByLabelText(/^password$/i), 'correct-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('Authentication flow', () => {
  beforeEach(() => {
    logout()
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the username/email + password login screen when unauthenticated', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to PayScope' })).toBeInTheDocument()
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/access token/i)).not.toBeInTheDocument()
  })

  it('does not render protected content while unauthenticated', () => {
    render(<App />)

    expect(screen.queryByRole('heading', { level: 1, name: 'PayScope' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('logs in against the real backend login endpoint and shows protected content on success', async () => {
    const user = userEvent.setup()
    const loginSpy = vi.spyOn(authApi, 'login').mockResolvedValue(tokenResponse)
    render(<App />)

    await signIn(user)

    expect(loginSpy).toHaveBeenCalledWith({
      username_or_email: 'hr.admin',
      password: 'correct-password',
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'PayScope' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it('requires both fields and reports missing ones as an accessible error, without calling the backend', async () => {
    const user = userEvent.setup()
    const loginSpy = vi.spyOn(authApi, 'login')
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter your username or email.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(loginSpy).not.toHaveBeenCalled()
  })

  it('shows a clear, accessible error for incorrect credentials and stays on the login screen', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect username/email or password.'),
    )
    render(<App />)

    await signIn(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Incorrect username/email or password.',
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to PayScope' })).toBeInTheDocument()
  })

  it('returns to the login screen on sign out', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockResolvedValue(tokenResponse)
    render(<App />)

    await signIn(user)
    await screen.findByRole('heading', { level: 1, name: 'PayScope' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in to PayScope' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('sends the token returned by the real login endpoint on the next authenticated API request', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockResolvedValue(tokenResponse)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyEmployeeListResponse), { status: 200 }))
    render(<App />)

    await signIn(user)
    await screen.findByRole('heading', { level: 1, name: 'PayScope' })
    await user.click(screen.getByRole('link', { name: 'Employees' }))

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/v1/employees'))).toBe(
        true,
      ),
    )
    const employeesCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/v1/employees'))
    const headers = new Headers(employeesCall?.[1]?.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${tokenResponse.access_token}`)
  })

  it('requires signing in again after sign-out before a protected route can be reached', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockResolvedValue(tokenResponse)
    const firstRender = render(<App />)

    await signIn(user)
    await screen.findByRole('heading', { level: 1, name: 'PayScope' })
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { level: 1, name: 'Sign in to PayScope' })
    firstRender.unmount()

    // A fresh mount at a protected path (simulating the user navigating
    // straight to it, e.g. via a bookmark or the address bar) after sign-out.
    window.history.pushState({}, '', '/employees')
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in to PayScope' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^employees$/i })).not.toBeInTheDocument()
  })
})
