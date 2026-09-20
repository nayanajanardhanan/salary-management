import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as employeesApi from '../api/employees'
import type { EmployeeRead } from '../types/employee'
import { EmployeeCreatePage } from './EmployeeCreatePage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/employees/new']}>
      <Routes>
        <Route path="/employees/new" element={<EmployeeCreatePage />} />
        <Route path="/employees/:employeeId" element={<div>Employee details page</div>} />
        <Route path="/employees" element={<div>Employee listing page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/employee code/i), 'EMP-010')
  await user.type(screen.getByLabelText(/first name/i), 'Grace')
  await user.type(screen.getByLabelText(/last name/i), 'Hopper')
  await user.type(screen.getByLabelText(/^department/i), 'Research')
  await user.type(screen.getByLabelText(/^country/i), 'United States')
  await user.type(screen.getByLabelText(/job title/i), 'Rear Admiral')
}

const createdEmployee: EmployeeRead = {
  id: 10,
  employee_code: 'EMP-010',
  first_name: 'Grace',
  last_name: 'Hopper',
  department: 'Research',
  country: 'United States',
  job_title: 'Rear Admiral',
  employment_status: 'active',
}

describe('EmployeeCreatePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the form with accessible labels and a clear submit button', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Add Employee' })).toBeInTheDocument()
    for (const label of [/employee code/i, /first name/i, /last name/i, /^department/i, /^country/i, /job title/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Employment status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create employee' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to employee listing/i })).toHaveAttribute(
      'href',
      '/employees',
    )
  })

  it('shows required-field validation errors and does not submit when fields are empty', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'createEmployee')

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(await screen.findByText('Employee code is required.')).toBeInTheDocument()
    expect(screen.getByText('First name is required.')).toBeInTheDocument()
    expect(screen.getByText('Last name is required.')).toBeInTheDocument()
    expect(screen.getByText('Department is required.')).toBeInTheDocument()
    expect(screen.getByText('Country is required.')).toBeInTheDocument()
    expect(screen.getByText('Job title is required.')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/employee code/i)).toHaveFocus()
  })

  it('rejects an employee code longer than the backend limit, without submitting', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'createEmployee')

    renderPage()
    await fillRequiredFields(user)
    fireEvent.change(screen.getByLabelText(/employee code/i), { target: { value: 'X'.repeat(21) } })

    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(await screen.findByText(/employee code must be 20 characters or fewer/i)).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('submits the form and sends the correct request payload', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'createEmployee').mockResolvedValue(createdEmployee)

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        employee_code: 'EMP-010',
        first_name: 'Grace',
        last_name: 'Hopper',
        department: 'Research',
        country: 'United States',
        job_title: 'Rear Admiral',
        employment_status: 'active',
      }),
    )
  })

  it('shows a clear success state, with the created employee, only after the API confirms creation', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'createEmployee').mockResolvedValue(createdEmployee)

    renderPage()
    expect(screen.queryByText(/created successfully/i)).not.toBeInTheDocument()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    const status = await screen.findByRole('status')
    expect(within(status).getByText(/created successfully/i)).toBeInTheDocument()
    expect(within(status).getByText(/EMP-010/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view employee details/i })).toHaveAttribute(
      'href',
      '/employees/10',
    )
    expect(screen.getByRole('link', { name: /back to employee listing/i })).toHaveAttribute(
      'href',
      '/employees',
    )
  })

  it('navigates to the new employee\'s details page from the success state', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'createEmployee').mockResolvedValue(createdEmployee)

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    await user.click(await screen.findByRole('link', { name: /view employee details/i }))

    expect(await screen.findByText('Employee details page')).toBeInTheDocument()
  })

  it('disables the submit button while the request is in progress, preventing duplicate submissions', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'createEmployee').mockReturnValue(new Promise(() => {}))

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    const pendingButton = screen.getByRole('button', { name: /creating employee/i })
    expect(pendingButton).toBeDisabled()

    await user.click(pendingButton)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('shows a backend validation error on the affected field', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'createEmployee').mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed.', [
        {
          location: ['body', 'job_title'],
          message: 'String should have at most 150 characters',
          type: 'string_too_long',
        },
      ]),
    )

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(await screen.findByText('String should have at most 150 characters')).toBeInTheDocument()
    expect(screen.getByLabelText(/job title/i)).toHaveFocus()
    expect(screen.queryByText(/created successfully/i)).not.toBeInTheDocument()
  })

  it('shows a duplicate-employee-code error on the employee code field', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'createEmployee').mockRejectedValue(
      new ApiError(409, 'EMPLOYEE_CODE_ALREADY_EXISTS', "Employee code 'EMP-010' already exists"),
    )

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(await screen.findByText("Employee code 'EMP-010' already exists")).toBeInTheDocument()
    expect(screen.getByLabelText(/employee code/i)).toHaveFocus()
  })

  it('shows a safe error message for an unauthorized response', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'createEmployee').mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid authentication credentials.'),
    )

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Missing or invalid authentication credentials.')).toBeInTheDocument()
  })

  it('shows a safe, accessible error message for an unexpected API error, without exposing internals', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'createEmployee').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/traceback|stack|internal_error/i)).not.toBeInTheDocument()
  })

  it('shows a safe error message for a network failure', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'createEmployee').mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.'),
    )

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/unable to reach the server/i)).toBeInTheDocument()
  })

  it('preserves entered values after a failed submission', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'createEmployee').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )

    renderPage()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText(/employee code/i)).toHaveValue('EMP-010')
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Grace')
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Hopper')
    expect(screen.getByLabelText(/^department/i)).toHaveValue('Research')
    expect(screen.getByLabelText(/^country/i)).toHaveValue('United States')
    expect(screen.getByLabelText(/job title/i)).toHaveValue('Rear Admiral')
  })
})
