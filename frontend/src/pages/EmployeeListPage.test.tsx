import { render, screen, waitFor } from '@testing-library/react'
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
})
