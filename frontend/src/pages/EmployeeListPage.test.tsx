import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as employeesApi from '../api/employees'
import type { EmployeeListResponse } from '../types/employee'
import { EmployeeListPage } from './EmployeeListPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <EmployeeListPage />
    </MemoryRouter>,
  )
}

const oneEmployeeResponse: EmployeeListResponse = {
  items: [
    {
      id: 1,
      employee_code: 'EMP-001',
      first_name: 'Ada',
      last_name: 'Lovelace',
      department: 'Engineering',
      country: 'United Kingdom',
      job_title: 'Software Engineer',
      employment_status: 'active',
      salary: { employee_id: 1, amount: '95000.00', currency: 'GBP' },
    },
  ],
  page: 1,
  page_size: 20,
  total: 1,
  has_next: false,
}

const emptyResponse: EmployeeListResponse = {
  items: [],
  page: 1,
  page_size: 20,
  total: 0,
  has_next: false,
}

const fullListResponse: EmployeeListResponse = {
  items: [
    oneEmployeeResponse.items[0],
    {
      id: 2,
      employee_code: 'EMP-002',
      first_name: 'Grace',
      last_name: 'Hopper',
      department: 'Research',
      country: 'United States',
      job_title: 'Rear Admiral',
      employment_status: 'active',
      salary: { employee_id: 2, amount: '105000.00', currency: 'USD' },
    },
  ],
  page: 1,
  page_size: 20,
  total: 2,
  has_next: false,
}

describe('EmployeeListPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an accessible loading state while the request is in flight', () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('renders employee name, department, country, salary amount, and currency on success', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(oneEmployeeResponse)

    renderPage()

    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('United Kingdom')).toBeInTheDocument()
    expect(screen.getByText(/GBP/)).toBeInTheDocument()
    expect(screen.getByText(/95,000\.00/)).toBeInTheDocument()
  })

  it('shows a clear, accessible empty state when the API returns no employees', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(emptyResponse)

    renderPage()

    await waitFor(() => expect(screen.getByText(/no employees found/i)).toBeInTheDocument())
  })

  it('shows a safe, user-friendly error state when the request fails, without exposing internals', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )

    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/traceback|stack|internal_error/i)).not.toBeInTheDocument()
  })

  it('uses the shared employee API module rather than fetching data itself', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(emptyResponse)

    renderPage()

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
  })

  it('has an accessible, labeled search input with a descriptive placeholder', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    const input = screen.getByLabelText('Search employees')
    expect(input).toHaveAttribute('placeholder', expect.stringMatching(/name.*employee id/i))
  })

  it('searches by a partial employee name and sends the correct search query parameter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ search: 'Lovel' }))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument()
  })

  it('searches by employee ID and sends the correct search query parameter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'EMP-001')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ search: 'EMP-001' }))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('forwards the search text as typed, case included, for the backend to match case-insensitively', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'ada')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ search: 'ada' }))
  })

  it('trims leading/trailing whitespace before sending the search value', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), '  Ada  ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ search: 'Ada' }))
    expect(screen.getByLabelText('Search employees')).toHaveValue('Ada')
  })

  it('does not send a request for whitespace-only input, and restores the unfiltered listing', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    expect(spy).toHaveBeenCalledTimes(1)

    await user.type(screen.getByLabelText('Search employees'), '   ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    // Trims to '', same as the already-applied '' search, so no new request.
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('restores the unfiltered listing when the search is cleared', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Ada')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument())

    spy.mockResolvedValueOnce(fullListResponse)
    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ search: '' }))
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByLabelText('Search employees')).toHaveValue('')
  })

  it('shows a clear, accessible message when a search has no matching employees', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockResolvedValueOnce(emptyResponse)
    await user.type(screen.getByLabelText('Search employees'), 'zzz-no-such-employee')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(screen.getByText(/no employees match/i)).toBeInTheDocument())
    expect(screen.getByText(/"zzz-no-such-employee"/)).toBeInTheDocument()
  })

  it('shows an accessible loading state while a search request is pending', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockReturnValueOnce(new Promise(() => {}))
    await user.type(screen.getByLabelText('Search employees'), 'Ada')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('shows a safe, accessible error state when a search request fails', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))
    await user.type(screen.getByLabelText('Search employees'), 'Ada')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })
})
