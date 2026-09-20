import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as employeesApi from './api/employees'
import { logout, setToken } from './auth/authStore'

/**
 * Exercises the real `ProtectedRoute`/`AuthProvider` (no separate mock guard),
 * so this verifies the employee listing page is wired into the existing
 * route-protection mechanism rather than a second one.
 */
describe('/employees route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
    window.history.pushState({}, '', '/')
  })

  it('redirects an unauthenticated visitor to /login instead of rendering the employee list', () => {
    window.history.pushState({}, '', '/employees')

    render(<App />)

    expect(screen.getByRole('heading', { name: /sign in to payscope/i })).toBeInTheDocument()
  })

  it('renders the employee list page for an authenticated visitor', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      has_next: false,
    })
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /^employees$/i })).toBeInTheDocument(),
    )
  })
})
