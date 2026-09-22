import { render, screen, waitFor, within } from '@testing-library/react'
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

  it('offers an "Add salary" link only when the employee has no salary record', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'),
    )

    renderPage('1')

    expect(await screen.findByRole('link', { name: /add salary/i })).toHaveAttribute(
      'href',
      '/employees/1/salary/new',
    )
  })

  it('does not offer an "Add salary" link when the employee already has a salary', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('link', { name: /add salary/i })).not.toBeInTheDocument()
  })

  it('offers an "Edit salary" link only when the employee has an existing salary record', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage()

    expect(await screen.findByRole('link', { name: /edit salary/i })).toHaveAttribute(
      'href',
      '/employees/1/salary/edit',
    )
  })

  it('does not offer an "Edit salary" link when the employee has no salary record', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'),
    )

    renderPage('1')

    await waitFor(() => expect(screen.getByText(/no salary record on file/i)).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /edit salary/i })).not.toBeInTheDocument()
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

  it('offers a "Delete salary" action only when the employee has an existing salary record', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage()

    expect(await screen.findByRole('button', { name: 'Delete salary' })).toBeInTheDocument()
  })

  it('does not offer a "Delete salary" action when the employee has no salary record', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'),
    )

    renderPage('1')

    await waitFor(() => expect(screen.getByText(/no salary record on file/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Delete salary' })).not.toBeInTheDocument()
  })

  it('opens a confirmation dialog identifying the employee, without deleting yet', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const deleteSpy = vi.spyOn(employeesApi, 'deleteEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))

    const dialog = screen.getByRole('dialog', { name: /delete salary record/i })
    expect(dialog).toHaveTextContent('Ada Lovelace')
    expect(dialog).toHaveTextContent('EMP-001')
    expect(dialog).toHaveTextContent(/employee record itself will not be deleted/i)
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('cancels without calling the deletion endpoint, and returns focus to the trigger', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const deleteSpy = vi.spyOn(employeesApi, 'deleteEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    const deleteButton = await screen.findByRole('button', { name: 'Delete salary' })
    await user.click(deleteButton)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(deleteButton).toHaveFocus()
  })

  it('closes the dialog via Escape without calling the deletion endpoint', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const deleteSpy = vi.spyOn(employeesApi, 'deleteEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('calls the deletion endpoint for the correct employee id when confirmed', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const deleteSpy = vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete salary' }))

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(1))
  })

  it('shows a loading state and disables the dialog controls while deletion is in progress', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete salary' }))

    const pendingButton = await within(dialog).findByRole('button', { name: /deleting/i })
    expect(pendingButton).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('prevents duplicate deletion requests while one is already in progress', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const deleteSpy = vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    const confirmButton = within(dialog).getByRole('button', { name: 'Delete salary' })
    await user.click(confirmButton)

    const pendingButton = await within(dialog).findByRole('button', { name: /deleting/i })
    await user.click(pendingButton)

    expect(deleteSpy).toHaveBeenCalledTimes(1)
  })

  it('updates the page to the no-salary state and shows a success message only after the API confirms deletion', async () => {
    const detailsSpy = vi
      .spyOn(employeesApi, 'fetchEmployeeDetails')
      .mockResolvedValueOnce(detailsResponse)
      .mockRejectedValueOnce(new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'))
    vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete salary' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/no salary record on file/i)).toBeInTheDocument())
    expect(screen.getByText('Salary deleted successfully.')).toBeInTheDocument()
    expect(screen.queryByText('95,000.00')).not.toBeInTheDocument()
    expect(detailsSpy).toHaveBeenCalledTimes(2)
  })

  it('keeps the dialog open and shows an error when the salary was already removed', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'),
    )
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete salary' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/no longer has a salary record/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a safe error message inside the dialog for an unauthorized response', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid authentication credentials.'),
    )
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete salary' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Missing or invalid authentication credentials.',
    )
  })

  it('shows a safe error message inside the dialog for a network failure', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.'),
    )
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete salary' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/unable to reach the server/i)
  })

  it('shows a safe, accessible error message inside the dialog for an unexpected API error, without exposing internals', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete salary' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong. Please try again.')
    expect(screen.queryByText(/traceback|stack|internal_error/i)).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
