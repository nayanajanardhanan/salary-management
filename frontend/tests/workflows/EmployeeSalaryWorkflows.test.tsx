import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import * as analyticsApi from '../../src/api/analytics'
import { ApiError } from '../../src/api/client'
import * as employeesApi from '../../src/api/employees'
import { logout, setToken } from '../../src/auth/authStore'
import type { SalaryStatistics } from '../../src/types/analytics'
import type { EmployeeListResponse, EmployeeRead, EmployeeSalaryDetails, Salary } from '../../src/types/employee'

/**
 * Cross-page integration tests: each test drives the real `<App />` tree
 * (real routing, `AuthProvider`, `ProtectedRoute`) through a complete user
 * journey spanning multiple pages, mocking only the API modules
 * (`src/api/*.ts`) — never a component. This complements, rather than
 * repeats, the exhaustive per-page unit tests already in `src/pages/*.test.tsx`
 * (e.g. `EmployeeListPage.test.tsx`'s ~80 cases already cover every
 * search/filter/sort/pagination combination in isolation); what's tested
 * here is that the pieces are wired together correctly end to end —
 * navigation, the auth guard, and data actually flowing from one page's
 * mutation into the next page's fetch.
 */

const emptyEmployeeListResponse: EmployeeListResponse = {
  items: [],
  page: 1,
  page_size: 20,
  total: 0,
  has_next: false,
}

const emptySalaryStatistics: SalaryStatistics = { overall: [], by_department: [], by_country: [] }

const filterOptionsResponse: SalaryStatistics = {
  overall: [{ currency: 'GBP', count: 1, average: '95000.00', minimum: '95000.00', maximum: '95000.00' }],
  by_department: [
    { department: 'Engineering', currency: 'GBP', count: 1, average: '95000.00', minimum: '95000.00', maximum: '95000.00' },
  ],
  by_country: [
    { country: 'United Kingdom', currency: 'GBP', count: 1, average: '95000.00', minimum: '95000.00', maximum: '95000.00' },
  ],
}

const ada: EmployeeRead = {
  id: 1,
  employee_code: 'EMP-001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  department: 'Engineering',
  country: 'United Kingdom',
  job_title: 'Software Engineer',
  employment_status: 'active',
}

const adaSalary: Salary = { employee_id: 1, amount: '95000.00', currency: 'GBP' }

const grace: EmployeeRead = {
  id: 2,
  employee_code: 'EMP-002',
  first_name: 'Grace',
  last_name: 'Hopper',
  department: 'Research',
  country: 'United States',
  job_title: 'Rear Admiral',
  employment_status: 'active',
}

const listWithBoth: EmployeeListResponse = {
  items: [
    { ...ada, salary: adaSalary },
    { ...grace, salary: null },
  ],
  page: 1,
  page_size: 20,
  total: 2,
  has_next: false,
}

const adaDetails: EmployeeSalaryDetails = { employee: ada, salary: adaSalary }

function mockListingBaseline() {
  vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(emptySalaryStatistics)
}

async function fillRequiredEmployeeFields(user: ReturnType<typeof userEvent.setup>, values: Record<string, string>) {
  await user.type(screen.getByLabelText(/employee code/i), values.employee_code)
  await user.type(screen.getByLabelText(/first name/i), values.first_name)
  await user.type(screen.getByLabelText(/last name/i), values.last_name)
  await user.type(screen.getByLabelText(/^department/i), values.department)
  await user.type(screen.getByLabelText(/^country/i), values.country)
  await user.type(screen.getByLabelText(/job title/i), values.job_title)
}

afterEach(() => {
  vi.restoreAllMocks()
  logout()
  window.history.pushState({}, '', '/')
})

describe('Employee listing workflow', () => {
  it('combines search, department/country, and salary-range filters with sorting, paginates, and resets to page 1 when a filter changes afterward', async () => {
    const user = userEvent.setup()
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(filterOptionsResponse)
    const listSpy = vi
      .spyOn(employeesApi, 'fetchEmployees')
      .mockResolvedValue({ ...listWithBoth, has_next: true })
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await screen.findByText('Ada Lovelace')

    const expectedParams: Record<string, unknown> = {
      page: 1,
      pageSize: 20,
      search: '',
      department: '',
      country: '',
      currency: '',
      minSalary: '',
      maxSalary: '',
    }

    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expectedParams.search = 'Lovel'
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expectedParams))

    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    expectedParams.department = 'Engineering'
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expectedParams))

    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')
    expectedParams.country = 'United Kingdom'
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expectedParams))

    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))
    expectedParams.currency = 'GBP'
    expectedParams.minSalary = '50000'
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expectedParams))

    await user.selectOptions(screen.getByLabelText('Sort by'), 'first_name')
    expectedParams.sortBy = 'first_name'
    expectedParams.sortOrder = 'asc'
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expectedParams))

    // Pagination preserves every active search/filter/sort criterion.
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expectedParams.page = 2
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expectedParams))

    // Changing a filter afterward resets pagination back to page 1, while
    // preserving the other active criteria (search/country/salary/sort).
    await user.selectOptions(screen.getByLabelText('Department'), '')
    expectedParams.department = ''
    expectedParams.page = 1
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expectedParams))
  })

  it('displays an accessible error, with a working retry, when the employee listing request fails', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    const listSpy = vi
      .spyOn(employeesApi, 'fetchEmployees')
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong. Please try again.')

    listSpy.mockResolvedValueOnce(listWithBoth)
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })
})

describe('Employee details workflow', () => {
  it('shows a distinct empty state, with a link to add one, for an employee with no salary record', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(listWithBoth)
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 2'),
    )
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Grace Hopper' }))

    expect(await screen.findByText(/no salary record on file/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add salary' })).toHaveAttribute('href', '/employees/2/salary/new')
  })

  it('shows an accessible not-found message for an employee id that does not exist', async () => {
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'Employee 999 not found'),
    )
    setToken('test-token')
    window.history.pushState({}, '', '/employees/999')

    render(<App />)

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument()
  })

  it('fetches the correct employee id when navigating between two different employees, leaving no stale data behind', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(listWithBoth)
    const detailsSpy = vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockImplementation((employeeId) =>
      employeeId === 1
        ? Promise.resolve(adaDetails)
        : Promise.reject(new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 2')),
    )
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)

    await user.click(await screen.findByRole('link', { name: 'Ada Lovelace' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText(/95,000\.00/)).toBeInTheDocument()
    await waitFor(() => expect(detailsSpy).toHaveBeenLastCalledWith(1))

    await user.click(screen.getByRole('link', { name: /back to employee listing/i }))
    await user.click(await screen.findByRole('link', { name: 'Grace Hopper' }))

    await waitFor(() => expect(detailsSpy).toHaveBeenLastCalledWith(2))
    expect(await screen.findByText(/no salary record on file/i)).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    expect(screen.queryByText(/95,000\.00/)).not.toBeInTheDocument()
  })
})

describe('Employee creation workflow', () => {
  it('shows required-field validation errors on an empty submit, without calling the API', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(emptyEmployeeListResponse)
    const createSpy = vi.spyOn(employeesApi, 'createEmployee')
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Add employee' }))
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(await screen.findByText('Employee code is required.')).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('shows a duplicate employee-code error and preserves entered values after a failed submission', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(emptyEmployeeListResponse)
    vi.spyOn(employeesApi, 'createEmployee').mockRejectedValue(
      new ApiError(409, 'EMPLOYEE_CODE_ALREADY_EXISTS', "Employee code 'EMP-001' already exists"),
    )
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Add employee' }))
    await fillRequiredEmployeeFields(user, {
      employee_code: 'EMP-001',
      first_name: 'Ada',
      last_name: 'Lovelace',
      department: 'Engineering',
      country: 'United Kingdom',
      job_title: 'Software Engineer',
    })
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(await screen.findByText("Employee code 'EMP-001' already exists")).toBeInTheDocument()
    expect(screen.getByLabelText(/employee code/i)).toHaveValue('EMP-001')
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Ada')
    expect(screen.getByLabelText(/^department/i)).toHaveValue('Engineering')
    expect(screen.queryByText(/created successfully/i)).not.toBeInTheDocument()
  })

  it('prevents duplicate employee-creation submissions while a request is in progress', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(emptyEmployeeListResponse)
    const createSpy = vi.spyOn(employeesApi, 'createEmployee').mockReturnValue(new Promise(() => {}))
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Add employee' }))
    await fillRequiredEmployeeFields(user, {
      employee_code: 'EMP-050',
      first_name: 'Katherine',
      last_name: 'Johnson',
      department: 'Research',
      country: 'United States',
      job_title: 'Mathematician',
    })
    await user.click(screen.getByRole('button', { name: 'Create employee' }))

    const pendingButton = screen.getByRole('button', { name: /creating employee/i })
    expect(pendingButton).toBeDisabled()
    await user.click(pendingButton)

    expect(createSpy).toHaveBeenCalledTimes(1)
  })
})

describe('Salary workflow', () => {
  it('creates a salary from the employee details page, using the correct employee id, and shows it after navigating back', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(listWithBoth)
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(grace)
    const detailsSpy = vi
      .spyOn(employeesApi, 'fetchEmployeeDetails')
      .mockRejectedValueOnce(new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 2'))
      .mockResolvedValueOnce({ employee: grace, salary: { employee_id: 2, amount: '120000.00', currency: 'USD' } })
    const createSalarySpy = vi.spyOn(employeesApi, 'createEmployeeSalary').mockResolvedValue({
      employee_id: 2,
      amount: '120000.00',
      currency: 'USD',
    })
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Grace Hopper' }))
    await user.click(await screen.findByRole('link', { name: 'Add salary' }))

    expect(await screen.findByText(/grace hopper/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/salary amount/i), '120000')
    await user.selectOptions(screen.getByLabelText(/currency/i), 'USD')
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    await waitFor(() => expect(createSalarySpy).toHaveBeenCalledWith(2, { amount: '120000', currency: 'USD' }))
    await user.click(await screen.findByRole('link', { name: /view employee details/i }))

    expect(await screen.findByText(/120,000\.00/)).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
    await waitFor(() => expect(detailsSpy).toHaveBeenCalledTimes(2))
  })

  it('shows the salary-conflict error, without clearing the form, when the employee already has a salary', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(listWithBoth)
    vi.spyOn(employeesApi, 'fetchEmployee').mockResolvedValue(grace)
    vi.spyOn(employeesApi, 'fetchEmployeeDetails').mockRejectedValue(
      new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 2'),
    )
    vi.spyOn(employeesApi, 'createEmployeeSalary').mockRejectedValue(
      new ApiError(409, 'SALARY_ALREADY_EXISTS', 'Employee 2 already has a salary record'),
    )
    setToken('test-token')
    window.history.pushState({}, '', '/employees/2/salary/new')

    render(<App />)
    await user.type(await screen.findByLabelText(/salary amount/i), '120000')
    await user.selectOptions(screen.getByLabelText(/currency/i), 'USD')
    await user.click(screen.getByRole('button', { name: 'Add salary' }))

    expect(await screen.findByText(/already has a salary record/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/salary amount/i)).toHaveValue('120000')
    expect(screen.getByLabelText(/currency/i)).toHaveValue('USD')
  })

  it('edits an existing salary, sends the correct update payload, and does not affect stored data after a failed attempt', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(listWithBoth)
    const detailsSpy = vi
      .spyOn(employeesApi, 'fetchEmployeeDetails')
      .mockResolvedValueOnce(adaDetails) // details page, first visit
      .mockResolvedValueOnce(adaDetails) // edit page load, prefill
      .mockResolvedValueOnce(adaDetails) // details page, after cancelling out of a failed edit
      .mockResolvedValueOnce(adaDetails) // edit page load, second attempt
      .mockResolvedValueOnce({ employee: ada, salary: { employee_id: 1, amount: '110000.00', currency: 'GBP' } }) // details page, after the successful edit
    const updateSpy = vi
      .spyOn(employeesApi, 'updateEmployeeSalary')
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))
      .mockResolvedValueOnce({ employee_id: 1, amount: '110000.00', currency: 'GBP' })
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Ada Lovelace' }))
    expect(await screen.findByText(/95,000\.00/)).toBeInTheDocument()

    // First attempt fails: the amount field keeps the typed value, and
    // backing out without retrying leaves the employee's stored salary
    // exactly as it was (95,000.00), proving the failed mutation never
    // took effect.
    await user.click(screen.getByRole('link', { name: 'Edit salary' }))
    const amountInput = await screen.findByLabelText(/salary amount/i)
    expect(amountInput).toHaveValue('95000.00')
    await user.clear(amountInput)
    await user.type(amountInput, '110000')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    expect(screen.getByLabelText(/salary amount/i)).toHaveValue('110000')

    await user.click(screen.getByRole('link', { name: /back to employee details/i }))
    expect(await screen.findByText(/95,000\.00/)).toBeInTheDocument()

    // Retrying and succeeding sends the correct payload and is reflected
    // back on the details page.
    await user.click(screen.getByRole('link', { name: 'Edit salary' }))
    const retryAmountInput = await screen.findByLabelText(/salary amount/i)
    await user.clear(retryAmountInput)
    await user.type(retryAmountInput, '110000')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(updateSpy).toHaveBeenLastCalledWith(1, { amount: '110000', currency: 'GBP' }))
    await user.click(await screen.findByRole('link', { name: /view employee details/i }))
    expect(await screen.findByText(/110,000\.00/)).toBeInTheDocument()
    expect(detailsSpy).toHaveBeenCalledTimes(5)
  })

  it('requires confirmation before deleting a salary, never calls the API on cancel, and updates the UI on success', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(listWithBoth)
    vi.spyOn(employeesApi, 'fetchEmployeeDetails')
      .mockResolvedValueOnce(adaDetails)
      .mockRejectedValueOnce(new ApiError(404, 'SALARY_NOT_FOUND', 'No salary record found for employee 1'))
    const deleteSpy = vi.spyOn(employeesApi, 'deleteEmployeeSalary').mockResolvedValue(undefined)
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Ada Lovelace' }))
    await user.click(await screen.findByRole('button', { name: 'Delete salary' }))

    const dialog = screen.getByRole('dialog', { name: /delete salary record/i })
    expect(dialog).toHaveTextContent('Ada Lovelace')
    expect(dialog).toHaveTextContent(/employee record itself will not be deleted/i)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/95,000\.00/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))
    const reopenedDialog = screen.getByRole('dialog')
    await user.click(within(reopenedDialog).getByRole('button', { name: 'Delete salary' }))

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Salary deleted successfully.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add salary' })).toHaveAttribute('href', '/employees/1/salary/new')
    expect(screen.queryByText(/95,000\.00/)).not.toBeInTheDocument()
  })
})

describe('Authentication', () => {
  it('attaches the stored access token to authenticated API requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      const body = url.includes('/analytics/') ? emptySalaryStatistics : emptyEmployeeListResponse
      return new Response(JSON.stringify(body), { status: 200 })
    })
    setToken('integration-test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    for (const call of fetchMock.mock.calls) {
      const headers = new Headers(call[1]?.headers)
      expect(headers.get('Authorization')).toBe('Bearer integration-test-token')
    }
  })

  it('returns to the login screen with a session-expired message when an authenticated request is rejected as unauthorized', async () => {
    // Mocked at the `fetch` level (not `employeesApi.fetchEmployees`) so the
    // real `apiRequest` 401-handling branch runs — it's what actually calls
    // `expireSession()`; a caller that merely catches an `ApiError` never
    // does that itself (`api/client.ts`'s doc comment).
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/analytics/')) {
        return new Response(JSON.stringify(emptySalaryStatistics), { status: 200 })
      }
      return new Response(
        JSON.stringify({
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication credentials.', details: null },
        }),
        { status: 401 },
      )
    })
    setToken('a-now-invalid-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in to PayScope' })).toBeInTheDocument()
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
  })

  it('signs out from a page other than Home, returning to the login screen', async () => {
    const user = userEvent.setup()
    mockListingBaseline()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(emptyEmployeeListResponse)
    setToken('test-token')
    window.history.pushState({}, '', '/employees')

    render(<App />)
    await screen.findByRole('heading', { name: /^employees$/i })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in to PayScope' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })
})
