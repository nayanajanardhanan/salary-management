import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as analyticsApi from './api/analytics'
import * as employeesApi from './api/employees'
import { logout, setToken } from './auth/authStore'

const emptySalaryStatistics = { overall: [], by_department: [], by_country: [] }

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
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(emptySalaryStatistics)
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /^employees$/i })).toBeInTheDocument(),
    )
  })
})

describe('/employees/:employeeId route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
    window.history.pushState({}, '', '/')
  })

  const oneEmployeeResponse = {
    items: [
      {
        id: 1,
        employee_code: 'EMP-001',
        first_name: 'Ada',
        last_name: 'Lovelace',
        department: 'Engineering',
        country: 'United Kingdom',
        job_title: 'Software Engineer',
        employment_status: 'active' as const,
        salary: { employee_id: 1, amount: '95000.00', currency: 'GBP' },
      },
    ],
    page: 1,
    page_size: 20,
    total: 1,
    has_next: false,
  }

  const detailsResponse = {
    employee: {
      id: 1,
      employee_code: 'EMP-001',
      first_name: 'Ada',
      last_name: 'Lovelace',
      department: 'Engineering',
      country: 'United Kingdom',
      job_title: 'Software Engineer',
      employment_status: 'active' as const,
    },
    salary: { employee_id: 1, amount: '95000.00', currency: 'GBP' },
  }

  it('redirects an unauthenticated visitor to /login instead of rendering employee details', () => {
    window.history.pushState({}, '', '/employees/1')

    render(<App />)

    expect(screen.getByRole('heading', { name: /sign in to payscope/i })).toBeInTheDocument()
  })

  it('navigates from the employee listing to that employee\'s details page, and back again', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(oneEmployeeResponse)
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(emptySalaryStatistics)
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)

    const nameLink = await screen.findByRole('link', { name: 'Ada Lovelace' })
    await user.click(nameLink)

    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText('EMP-001')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /back to employee listing/i }))

    expect(await screen.findByRole('heading', { name: /^employees$/i })).toBeInTheDocument()
  })
})

describe('/analytics route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
    window.history.pushState({}, '', '/')
  })

  it('redirects an unauthenticated visitor to /login instead of rendering the analytics dashboard', () => {
    window.history.pushState({}, '', '/analytics')

    render(<App />)

    expect(screen.getByRole('heading', { name: /sign in to payscope/i })).toBeInTheDocument()
  })

  it('renders the analytics dashboard for an authenticated visitor, reachable via the primary nav', async () => {
    const user = userEvent.setup()
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(emptySalaryStatistics)
    setToken('test-token')
    window.history.pushState({}, '', '/')

    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Analytics' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /^salary analytics$/i }),
    ).toBeInTheDocument()
  })
})

describe('/employees/new route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
    window.history.pushState({}, '', '/')
  })

  it('redirects an unauthenticated visitor to /login instead of rendering the creation form', () => {
    window.history.pushState({}, '', '/employees/new')

    render(<App />)

    expect(screen.getByRole('heading', { name: /sign in to payscope/i })).toBeInTheDocument()
  })

  it('is reachable from the employee listing, and creates an employee for an authenticated visitor', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      has_next: false,
    })
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(emptySalaryStatistics)
    vi.spyOn(employeesApi, 'createEmployee').mockResolvedValue({
      id: 99,
      employee_code: 'EMP-099',
      first_name: 'Katherine',
      last_name: 'Johnson',
      department: 'Research',
      country: 'United States',
      job_title: 'Mathematician',
      employment_status: 'active',
    })
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)

    await user.click(await screen.findByRole('link', { name: 'Add employee' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Add Employee' })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/employee code/i), 'EMP-099')
    await user.type(screen.getByLabelText(/first name/i), 'Katherine')
    await user.type(screen.getByLabelText(/last name/i), 'Johnson')
    await user.type(screen.getByLabelText(/^department/i), 'Research')
    await user.type(screen.getByLabelText(/^country/i), 'United States')
    await user.type(screen.getByLabelText(/job title/i), 'Mathematician')
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(await screen.findByText(/created successfully/i)).toBeInTheDocument()
  })
})
