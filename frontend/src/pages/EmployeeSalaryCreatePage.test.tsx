import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as employeesApi from '../api/employees'
import type { EmployeeRead, Salary } from '../types/employee'
import { EmployeeSalaryCreatePage } from './EmployeeSalaryCreatePage'

function renderPage(employeeId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/employees/${employeeId}/salary/new`]}>
      <Routes>
        <Route path="/employees/:employeeId/salary/new" element={<EmployeeSalaryCreatePage />} />
        <Route path="/employees/:employeeId" element={<div>Employee details page</div>} />
        <Route path="/employees" element={<div>Employee listing page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const employee: EmployeeRead = {
  id: 1,
  employee_code: 'EMP-001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  department: 'Engineering',
  country: 'United Kingdom',
  job_title: 'Software Engineer',
  employment_status: 'active',
}

const createdSalary: Salary = { employee_id: 1, amount: '95000.00', currency: 'GBP' }

async function fillValidFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/salary amount/i), '95000')
  await user.selectOptions(screen.getByLabelText(/currency/i), 'GBP')
}

describe('EmployeeSalaryCreatePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the form with accessible labels and the employee\'s identity', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)

    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Add Salary' })).toBeInTheDocument()
    expect(await screen.findByText(/ada lovelace/i)).toBeInTheDocument()
    expect(screen.getByText(/emp-001/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/salary amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add salary' })).toBeInTheDocument()
  })

  it('fetches the employee identified by the route id', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)

    renderPage('1')

    await waitFor(() => expect(spy).toHaveBeenCalledWith(1))
  })

  it('uses a different employee id when the route param differs', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue({ ...employee, id: 42 })

    renderPage('42')

    await waitFor(() => expect(spy).toHaveBeenCalledWith(42))
  })

  it('shows required-field validation errors and does not submit when fields are empty', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    const createSpy = vi.spyOn(employeesApi, 'createEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    expect(await screen.findByText('Salary amount is required.')).toBeInTheDocument()
    expect(screen.getByText('Currency is required.')).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/salary amount/i)).toHaveFocus()
  })

  it('rejects a negative salary amount, without submitting', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    const createSpy = vi.spyOn(employeesApi, 'createEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    fireEvent.change(screen.getByLabelText(/salary amount/i), { target: { value: '-500' } })
    await user.selectOptions(screen.getByLabelText(/currency/i), 'GBP')
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    expect(await screen.findByText(/non-negative amount/i)).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('rejects a salary amount with more than 2 decimal places, without submitting', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    const createSpy = vi.spyOn(employeesApi, 'createEmployeeSalary')
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    fireEvent.change(screen.getByLabelText(/salary amount/i), { target: { value: '1000.999' } })
    await user.selectOptions(screen.getByLabelText(/currency/i), 'GBP')
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    expect(await screen.findByText(/non-negative amount/i)).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('submits the form and sends the correct request payload for the current employee', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    const spy = vi.spyOn(employeesApi, 'createEmployeeSalary').mockResolvedValue(createdSalary)
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    await waitFor(() => expect(spy).toHaveBeenCalledWith(1, { amount: '95000', currency: 'GBP' }))
  })

  it('shows a clear success state, with the created salary, only after the API confirms creation', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockResolvedValue(createdSalary)
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    const status = await screen.findByRole('status')
    expect(within(status).getByText(/was added for/i)).toBeInTheDocument()
    expect(within(status).getByText(/ada lovelace/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view employee details/i })).toHaveAttribute('href', '/employees/1')
    expect(screen.getByRole('link', { name: /back to employee listing/i })).toHaveAttribute('href', '/employees')
  })

  it('navigates to the employee details page from the success state', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockResolvedValue(createdSalary)
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    await user.click(await screen.findByRole('link', { name: /view employee details/i }))

    expect(await screen.findByText('Employee details page')).toBeInTheDocument()
  })

  it('disables the submit button while the request is in progress, preventing duplicate submissions', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    const spy = vi.spyOn(employeesApi, 'createEmployeeSalary').mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    const pendingButton = screen.getByRole('button', { name: /adding salary/i })
    expect(pendingButton).toBeDisabled()

    await user.click(pendingButton)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('shows a backend validation error on the amount field', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed.', [
        { location: ['body', 'amount'], message: 'Input should be greater than or equal to 0', type: 'greater_than_equal' },
      ]),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    expect(await screen.findByText('Input should be greater than or equal to 0')).toBeInTheDocument()
    expect(screen.getByLabelText(/salary amount/i)).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a backend unsupported-currency validation error on the currency field', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed.', [
        { location: ['body', 'currency'], message: "'XTS' is not a supported currency code.", type: 'value_error' },
      ]),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    expect(await screen.findByText("'XTS' is not a supported currency code.")).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toHaveFocus()
  })

  it('shows a duplicate-salary conflict as a form-level error', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockRejectedValue(
      new ApiError(409, 'SALARY_ALREADY_EXISTS', 'Employee 1 already has a salary record'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/already has a salary record/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an accessible not-found message when the employee does not exist', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockRejectedValue(
      new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'Employee 999 not found'),
    )

    renderPage('999')

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/salary amount/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to employee listing/i })).toHaveAttribute('href', '/employees')
  })

  it('shows a not-found message for an invalid employee id, without requesting the employee', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployee')

    renderPage('not-a-number')

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows a safe error message for an unauthorized response on submit', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid authentication credentials.'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Missing or invalid authentication credentials.')).toBeInTheDocument()
  })

  it('shows a safe, accessible error message for an unexpected API error, without exposing internals', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/traceback|stack|internal_error/i)).not.toBeInTheDocument()
  })

  it('shows a safe error message for a network failure', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/unable to reach the server/i)).toBeInTheDocument()
  })

  it('preserves entered values after a failed submission', async () => {
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(employee)
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )
    const user = userEvent.setup()

    renderPage()
    await screen.findByLabelText(/salary amount/i)
    await fillValidFields(user)
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText(/salary amount/i)).toHaveValue('95000')
    expect(screen.getByLabelText(/currency/i)).toHaveValue('GBP')
  })
})
