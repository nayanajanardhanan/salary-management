import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as employeesApi from '../api/employees'
import type { EmployeeSalaryDetails, Salary } from '../types/employee'
import { EmployeeSalaryEditPage } from './EmployeeSalaryEditPage'

function renderPage(employeeId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/employees/${employeeId}/salary/edit`]}>
      <Routes>
        <Route path="/employees/:employeeId/salary/edit" element={<EmployeeSalaryEditPage />} />
        <Route path="/employees/:employeeId/salary/new" element={<div>Salary creation page</div>} />
        <Route path="/employees/:employeeId" element={<div>Employee details page</div>} />
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

const updatedSalary: Salary = { employee_id: 1, amount: '105000.00', currency: 'USD' }

async function fillValidFields(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/salary amount/i), { target: { value: '105000' } })
  await user.selectOptions(screen.getByLabelText(/currency/i), 'USD')
}

describe('EmployeeSalaryEditPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the form with accessible labels and the employee\'s identity', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Edit Salary' })).toBeInTheDocument()
    expect(await screen.findByText(/ada lovelace/i)).toBeInTheDocument()
    expect(screen.getByText(/emp-001/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/salary amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it("prefills the form with the employee's existing salary values", async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage()

    expect(await screen.findByLabelText(/salary amount/i)).toHaveValue('95000.00')
    expect(screen.getByLabelText(/currency/i)).toHaveValue('GBP')
  })

  it('fetches details for the employee identified by the route id', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)

    renderPage('1')

    await waitFor(() => expect(spy).toHaveBeenCalledWith(1))
  })

  it('uses a different employee id when the route param differs', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue({
      ...detailsResponse,
      employee: { ...detailsResponse.employee, id: 42 },
      salary: { ...detailsResponse.salary, employee_id: 42 },
    })

    renderPage('42')

    await waitFor(() => expect(spy).toHaveBeenCalledWith(42))
  })

  it('shows required-field validation errors and does not submit when amount is cleared', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const updateSpy = vi.spyOn(employeesApi, 'updateEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    fireEvent.change(screen.getByLabelText(/salary amount/i), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Salary amount is required.')).toBeInTheDocument()
    expect(updateSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/salary amount/i)).toHaveFocus()
  })

  it('rejects a negative salary amount, without submitting', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const updateSpy = vi.spyOn(employeesApi, 'updateEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    fireEvent.change(screen.getByLabelText(/salary amount/i), { target: { value: '-500' } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/non-negative amount/i)).toBeInTheDocument()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('rejects a salary amount with more than 2 decimal places, without submitting', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const updateSpy = vi.spyOn(employeesApi, 'updateEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    fireEvent.change(screen.getByLabelText(/salary amount/i), { target: { value: '1000.999' } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/non-negative amount/i)).toBeInTheDocument()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('submits the form and sends the correct request payload for the current employee', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const spy = vi.spyOn(employeesApi, 'updateEmployeeSalary').mockResolvedValue(updatedSalary)
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(spy).toHaveBeenCalledWith(1, { amount: '105000', currency: 'USD' }))
  })

  it('shows a clear success state, with the updated salary, only after the API confirms the update', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockResolvedValue(updatedSalary)
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const status = await screen.findByRole('status')
    expect(within(status).getByText(/was updated to/i)).toBeInTheDocument()
    expect(within(status).getByText(/ada lovelace/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view employee details/i })).toHaveAttribute('href', '/employees/1')
    expect(screen.getByRole('link', { name: /back to employee listing/i })).toHaveAttribute('href', '/employees')
  })

  it('navigates to the employee details page from the success state', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockResolvedValue(updatedSalary)
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await user.click(await screen.findByRole('link', { name: /view employee details/i }))

    expect(await screen.findByText('Employee details page')).toBeInTheDocument()
  })

  it('disables the submit button while the request is in progress, preventing duplicate submissions', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    const spy = vi.spyOn(employeesApi, 'updateEmployeeSalary').mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const pendingButton = screen.getByRole('button', { name: /saving changes/i })
    expect(pendingButton).toBeDisabled()

    await user.click(pendingButton)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('shows a backend validation error on the amount field', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed.', [
        { location: ['body', 'amount'], message: 'Input should be greater than or equal to 0', type: 'greater_than_equal' },
      ]),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Input should be greater than or equal to 0')).toBeInTheDocument()
    expect(screen.getByLabelText(/salary amount/i)).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a backend unsupported-currency validation error on the currency field', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed.', [
        { location: ['body', 'currency'], message: "'XTS' is not a supported currency code.", type: 'value_error' },
      ]),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText("'XTS' is not a supported currency code.")).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toHaveFocus()
  })

  it('shows a salary-not-found error as a form-level message when the salary was removed before submission', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/no longer has a salary record/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a distinct, accessible message with a link to add a salary when the employee has none to edit', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'),
    )

    renderPage()

    expect(await screen.findByText(/no salary record to edit/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add salary/i })).toHaveAttribute('href', '/employees/1/salary/new')
    expect(screen.queryByLabelText(/salary amount/i)).not.toBeInTheDocument()
  })

  it('shows an accessible not-found message when the employee does not exist', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'Employee 999 not found'),
    )

    renderPage('999')

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/salary amount/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to employee listing/i })).toHaveAttribute('href', '/employees')
  })

  it('shows a safe error message for an unauthorized response on submit', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid authentication credentials.'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Missing or invalid authentication credentials.')).toBeInTheDocument()
  })

  it('shows a safe, accessible error message for an unexpected API error, without exposing internals', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/traceback|stack|internal_error/i)).not.toBeInTheDocument()
  })

  it('shows a safe error message for a network failure', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/unable to reach the server/i)).toBeInTheDocument()
  })

  it('preserves entered values after a failed submission', async () => {
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockResolvedValue(detailsResponse)
    vi.spyOn(employeesApi, 'updateEmployeeSalary').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText(/salary amount/i)).toHaveValue('105000')
    expect(screen.getByLabelText(/currency/i)).toHaveValue('USD')
  })
})
