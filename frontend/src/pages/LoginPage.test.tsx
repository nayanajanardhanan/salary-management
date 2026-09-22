import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../api/auth'
import { ApiError } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { getToken, logout } from '../auth/authStore'
import { LoginPage } from './LoginPage'

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Protected home page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  it('renders a username/email + password form with an accessible submit button', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to PayScope' })).toBeInTheDocument()
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('never renders a manual access-token input', () => {
    renderPage()

    expect(screen.queryByLabelText(/access token/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/access token/i)).not.toBeInTheDocument()
  })

  it('requires a username/email and a password before submitting', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(authApi, 'login')

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter your username or email.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('submits the correct request payload', async () => {
    const user = userEvent.setup()
    const spy = vi
      .spyOn(authApi, 'login')
      .mockResolvedValue({ access_token: 'issued-token', token_type: 'bearer', expires_in: 3600 })

    renderPage()
    await user.type(screen.getByLabelText(/username or email/i), 'hr.admin')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        username_or_email: 'hr.admin',
        password: 'correct-password',
      }),
    )
  })

  it('stores the returned access token and navigates away from /login on success', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockResolvedValue({
      access_token: 'issued-token',
      token_type: 'bearer',
      expires_in: 3600,
    })

    renderPage()
    await user.type(screen.getByLabelText(/username or email/i), 'hr.admin')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Protected home page')).toBeInTheDocument()
    expect(getToken()).toBe('issued-token')
  })

  it('never displays the issued access token to the user', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockResolvedValue({
      access_token: 'a-very-secret-issued-token',
      token_type: 'bearer',
      expires_in: 3600,
    })

    renderPage()
    await user.type(screen.getByLabelText(/username or email/i), 'hr.admin')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByText('Protected home page')
    expect(screen.queryByText(/a-very-secret-issued-token/)).not.toBeInTheDocument()
  })

  it('shows an accessible error for incorrect credentials, without navigating away', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect username/email or password.'),
    )

    renderPage()
    await user.type(screen.getByLabelText(/username or email/i), 'hr.admin')
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Incorrect username/email or password.')
    expect(screen.queryByText('Protected home page')).not.toBeInTheDocument()
    expect(getToken()).toBeNull()
  })

  it('shows a safe error message for a network failure', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.'),
    )

    renderPage()
    await user.type(screen.getByLabelText(/username or email/i), 'hr.admin')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/unable to reach the server/i)
  })

  it('disables the submit button while the request is in progress, preventing duplicate submissions', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(authApi, 'login').mockReturnValue(new Promise(() => {}))

    renderPage()
    await user.type(screen.getByLabelText(/username or email/i), 'hr.admin')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const pendingButton = screen.getByRole('button', { name: /signing in/i })
    expect(pendingButton).toBeDisabled()

    await user.click(pendingButton)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('redirects an already-authenticated visitor away from /login', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({
      access_token: 'issued-token',
      token_type: 'bearer',
      expires_in: 3600,
    })
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText(/username or email/i), 'hr.admin')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByText('Protected home page')

    // Re-rendering /login while a token is already stored should redirect immediately.
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>Another protected home page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByText('Another protected home page')).toBeInTheDocument()
  })
})
