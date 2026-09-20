import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as employeesApi from '../api/employees'
import type { EmployeeSalaryDetails } from '../types/employee'
import { EmployeeDetailsPage } from './EmployeeDetailsPage'

function renderPage(employeeId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/employees/${employeeId}`]}>
      <Routes>
        <Route path="/employees/:employeeId" element={<EmployeeDetailsPage />} />
        <Route path="/employees" element={<div>Employee listing page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const detailsResponse: EmployeeSalaryDetails = {
  employee: {
    id: 1,
    employee_code: 'EMP-001',
    first_name: 'Ada',
    last_name: 'Lovelace',
    department: 'Engineering',
    country: 'United Kingdom',
    job_title: 'Software Engineer',
    employment_status: 'active',
  },
  salary: { employee_id: 1, amount: '95000.00', currency: 'GBP' },
}

describe('EmployeeDetailsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an accessible loading state while the request is in flight', () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('requests details for the employee id from the route', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage('1')

    await waitFor(() => expect(spy).toHaveBeenCalledWith(1))
  })

  it('uses a different employee id when the route param differs', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue({
      ...detailsResponse,
      employee: { ...detailsResponse.employee, id: 42 },
    })

    renderPage('42')

    await waitFor(() => expect(spy).toHaveBeenCalledWith(42))
  })

  it('displays employee id/code, name, department, country, and other employee fields', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument(),
    )
    expect(screen.getByText('EMP-001')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('United Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('displays the current salary amount and currency', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage()

    await waitFor(() => expect(screen.getByText('95,000.00')).toBeInTheDocument())
    expect(screen.getByText('GBP')).toBeInTheDocument()
  })

  it('shows an accessible not-found message for an employee that does not exist', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'Employee 999 not found'),
    )

    renderPage('999')

    await waitFor(() => expect(screen.getByText(/could not be found/i)).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a distinct, accessible message when the employee has no salary record', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText(/no salary record on file/i)).toBeInTheDocument())
    expect(screen.queryByText(/could not be found/i)).not.toBeInTheDocument()
  })

  it('shows a safe, accessible error state for other API failures, without exposing internals', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )

    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/traceback|stack|internal_error/i)).not.toBeInTheDocument()
  })

  it('retries the request from the error state', async () => {
    const user = userEvent.setup()
    const spy = vi
      .spyOn(employeesApi, 'fetchEmployeeDetails')
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))

    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    spy.mockResolvedValueOnce(detailsResponse)
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument(),
    )
  })

  it('provides a keyboard-accessible link back to the employee listing', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument(),
    )

    const backLink = screen.getByRole('link', { name: /back to employee listing/i })
    expect(backLink).toHaveAttribute('href', '/employees')

    await user.click(backLink)

    expect(await screen.findByText('Employee listing page')).toBeInTheDocument()
  })

  it('shows the back link even while details are loading or have failed to load', () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('link', { name: /back to employee listing/i })).toBeInTheDocument()
  })
})
