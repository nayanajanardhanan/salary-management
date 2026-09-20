import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as analyticsApi from '../api/analytics'
import { ApiError } from '../api/client'
import * as employeesApi from '../api/employees'
import type { SalaryStatistics } from '../types/analytics'
import { EMPLOYEE_SORT_FIELDS } from '../types/employee'
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

const pageOneOfManyResponse: EmployeeListResponse = {
  items: [oneEmployeeResponse.items[0]],
  page: 1,
  page_size: 20,
  total: 45,
  has_next: true,
}

const pageTwoOfManyResponse: EmployeeListResponse = {
  items: [fullListResponse.items[1]],
  page: 2,
  page_size: 20,
  total: 45,
  has_next: true,
}

const lastPageOfManyResponse: EmployeeListResponse = {
  items: [fullListResponse.items[1]],
  page: 3,
  page_size: 20,
  total: 45,
  has_next: false,
}

const filterOptionsResponse: SalaryStatistics = {
  overall: [
    { currency: 'GBP', count: 1, average: '95000.00', minimum: '95000.00', maximum: '95000.00' },
    { currency: 'USD', count: 1, average: '105000.00', minimum: '105000.00', maximum: '105000.00' },
  ],
  by_department: [
    {
      department: 'Engineering',
      currency: 'GBP',
      count: 1,
      average: '95000.00',
      minimum: '95000.00',
      maximum: '95000.00',
    },
    // Same department, a second currency — verifies de-duplication in
    // `useEmployeeFilterOptions` (a department/country appears once per
    // currency group in the raw statistics response).
    {
      department: 'Engineering',
      currency: 'USD',
      count: 1,
      average: '120000.00',
      minimum: '120000.00',
      maximum: '120000.00',
    },
    {
      department: 'Research',
      currency: 'USD',
      count: 1,
      average: '105000.00',
      minimum: '105000.00',
      maximum: '105000.00',
    },
  ],
  by_country: [
    {
      country: 'United Kingdom',
      currency: 'GBP',
      count: 1,
      average: '95000.00',
      minimum: '95000.00',
      maximum: '95000.00',
    },
    {
      country: 'United States',
      currency: 'USD',
      count: 1,
      average: '105000.00',
      minimum: '105000.00',
      maximum: '105000.00',
    },
  ],
}

describe('EmployeeListPage', () => {
  beforeEach(() => {
    // Every test exercises the employee listing; filter dropdown options
    // (sourced from `api/analytics.ts`) are a separate concern, so default
    // them here rather than repeating this mock in every test.
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockResolvedValue(filterOptionsResponse)
  })

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
    const table = screen.getByRole('table')
    expect(within(table).getByText('Engineering')).toBeInTheDocument()
    expect(within(table).getByText('United Kingdom')).toBeInTheDocument()
    expect(within(table).getByText(/GBP/)).toBeInTheDocument()
    expect(within(table).getByText(/95,000\.00/)).toBeInTheDocument()
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

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'Lovel', department: '', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )
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

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'EMP-001', department: '', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )
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

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'ada', department: '', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )
  })

  it('trims leading/trailing whitespace before sending the search value', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), '  Ada  ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'Ada', department: '', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )
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

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: '', department: '', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )
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

  it('renders department and country filter dropdowns, with accessible labels and visible options', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    const departmentSelect = await screen.findByLabelText('Department')
    const countrySelect = screen.getByLabelText('Country')

    expect(within(departmentSelect).getByText('All departments')).toBeInTheDocument()
    expect(within(departmentSelect).getByText('Engineering')).toBeInTheDocument()
    expect(within(departmentSelect).getByText('Research')).toBeInTheDocument()
    expect(within(countrySelect).getByText('All countries')).toBeInTheDocument()
    expect(within(countrySelect).getByText('United Kingdom')).toBeInTheDocument()
    expect(within(countrySelect).getByText('United States')).toBeInTheDocument()

    // "Engineering" appears once per currency in the raw statistics
    // response (fixture has GBP and USD) but must be de-duplicated to a
    // single option.
    expect(within(departmentSelect).getAllByText('Engineering')).toHaveLength(1)
    expect(within(departmentSelect).getAllByRole('option')).toHaveLength(3)
  })

  it('filters by department only and sends the correct query parameter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: '', department: 'Engineering', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Department')).toHaveValue('Engineering')
  })

  it('filters by country only and sends the correct query parameter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Country')

    const oneUsEmployeeResponse: EmployeeListResponse = {
      ...oneEmployeeResponse,
      items: [fullListResponse.items[1]],
    }
    spy.mockResolvedValueOnce(oneUsEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Country'), 'United States')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: '', department: '', country: 'United States', currency: '', minSalary: '', maxSalary: '' }),
    )
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  it('combines department and country filters', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: '', department: 'Engineering', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: 'Engineering',
        country: 'United Kingdom', currency: '', minSalary: '', maxSalary: ''
      }),
    )
  })

  it('combines search with a department filter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'Lovel', department: '', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'Lovel', department: 'Engineering', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )
  })

  it('combines search with a country filter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Country')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'Lovel', department: '', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: 'Lovel',
        department: '',
        country: 'United Kingdom', currency: '', minSalary: '', maxSalary: ''
      }),
    )
  })

  it('combines search, department, and country together', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: 'Lovel',
        department: 'Engineering',
        country: 'United Kingdom', currency: '', minSalary: '', maxSalary: ''
      }),
    )
  })

  it('clears a single filter by selecting "All" for it, restoring the other active criteria', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: 'Engineering',
        country: 'United Kingdom', currency: '', minSalary: '', maxSalary: ''
      }),
    )

    spy.mockResolvedValueOnce(fullListResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'All departments')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: '', department: '', country: 'United Kingdom', currency: '', minSalary: '', maxSalary: '' }),
    )
    expect(screen.getByLabelText('Department')).toHaveValue('')
    expect(screen.getByLabelText('Country')).toHaveValue('United Kingdom')
  })

  it('clears all filters via the "Clear filters" action, without affecting search', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'Lovel', department: '', country: '', currency: '', minSalary: '', maxSalary: '' }),
    )
    expect(screen.getByLabelText('Department')).toHaveValue('')
    expect(screen.getByLabelText('Country')).toHaveValue('')
    expect(screen.getByLabelText('Search employees')).toHaveValue('Lovel')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('shows a clear, accessible message when a filter combination has no matching employees', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValueOnce(emptyResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')

    await waitFor(() => expect(screen.getByText(/no employees match/i)).toBeInTheDocument())
    expect(screen.getByText(/department "Engineering"/)).toBeInTheDocument()
  })

  it('shows a safe, accessible error state when a filtered request fails', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('disables the filter selects while filter options are loading, without blocking the employee listing', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockReturnValue(new Promise(() => {}))

    renderPage()

    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    expect(screen.getByLabelText('Department')).toBeDisabled()
    expect(screen.getByLabelText('Country')).toBeDisabled()
  })

  it('shows a non-blocking notice, and still lists employees, when filter options fail to load', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)
    vi.spyOn(analyticsApi, 'fetchSalaryStatistics').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.getByLabelText('Department')).not.toBeDisabled()
  })

  it('renders a currency dropdown sourced from the backend, with accessible labels for currency/min/max', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    const currencySelect = await screen.findByLabelText('Currency')
    expect(within(currencySelect).getByText('Select currency')).toBeInTheDocument()
    expect(within(currencySelect).getByText('GBP')).toBeInTheDocument()
    expect(within(currencySelect).getByText('USD')).toBeInTheDocument()
    expect(screen.getByLabelText('Minimum salary')).toBeInTheDocument()
    expect(screen.getByLabelText('Maximum salary')).toBeInTheDocument()
  })

  it('filters by minimum salary only, scoped to the selected currency', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: '',
        country: '',
        currency: 'GBP',
        minSalary: '50000',
        maxSalary: '',
      }),
    )
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('filters by maximum salary only, scoped to the selected currency', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Maximum salary'), '100000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: '',
        country: '',
        currency: 'GBP',
        minSalary: '',
        maxSalary: '100000',
      }),
    )
  })

  it('filters by minimum and maximum salary together', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.type(screen.getByLabelText('Maximum salary'), '100000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: '',
        country: '',
        currency: 'GBP',
        minSalary: '50000',
        maxSalary: '100000',
      }),
    )
  })

  it('applies a currency-only filter without requiring a salary amount', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: '',
        country: '',
        currency: 'GBP',
        minSalary: '',
        maxSalary: '',
      }),
    )
  })

  it('requires a currency before applying a minimum/maximum salary filter, and does not send a request', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Minimum salary')
    expect(spy).toHaveBeenCalledTimes(1)

    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/select a currency/i)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('rejects a negative minimum salary with an accessible message, and does not send a request', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')
    expect(spy).toHaveBeenCalledTimes(1)

    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '-100')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/minimum salary must not be negative/i)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Minimum salary')).toHaveAttribute('aria-invalid', 'true')
  })

  it('rejects a negative maximum salary with an accessible message, and does not send a request', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Maximum salary'), '-1')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/maximum salary must not be negative/i)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-numeric minimum salary with an accessible message, and does not send a request', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), 'not-a-number')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/minimum salary must be a number/i)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('rejects a minimum salary greater than the maximum salary, and does not send a request', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '5000')
    await user.type(screen.getByLabelText('Maximum salary'), '1000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /minimum salary must not exceed maximum salary/i,
    )
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('combines a salary range filter with search', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: 'Lovel',
        department: '',
        country: '',
        currency: 'GBP',
        minSalary: '50000',
        maxSalary: '',
      }),
    )
  })

  it('combines a salary range filter with department and country', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.type(screen.getByLabelText('Maximum salary'), '100000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: 'Engineering',
        country: 'United Kingdom',
        currency: 'GBP',
        minSalary: '50000',
        maxSalary: '100000',
      }),
    )
  })

  it('clears the salary filter without affecting other active filters', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    expect(screen.queryByRole('button', { name: 'Clear salary filter' })).not.toBeInTheDocument()

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))
    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: 'Engineering',
        country: '',
        currency: 'GBP',
        minSalary: '50000',
        maxSalary: '',
      }),
    )

    spy.mockResolvedValueOnce(oneEmployeeResponse)
    await user.click(screen.getByRole('button', { name: 'Clear salary filter' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith({ page: 1, pageSize: 20,
        search: '',
        department: 'Engineering',
        country: '',
        currency: '',
        minSalary: '',
        maxSalary: '',
      }),
    )
    expect(screen.getByLabelText('Currency')).toHaveValue('')
    expect(screen.getByLabelText('Minimum salary')).toHaveValue('')
    expect(screen.getByLabelText('Department')).toHaveValue('Engineering')
    expect(screen.queryByRole('button', { name: 'Clear salary filter' })).not.toBeInTheDocument()
  })

  it('shows an accessible message when a salary range filter has no matching employees', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockResolvedValueOnce(emptyResponse)
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '500000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    await waitFor(() => expect(screen.getByText(/no employees match/i)).toBeInTheDocument())
    expect(screen.getByText(/salary at least 500000 GBP/i)).toBeInTheDocument()
  })

  it('shows a safe, accessible error state when a salary-filtered request fails', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('makes the currency scope clear to the user, before and after selecting a currency', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    expect(screen.getByText(/salaries are never combined across currencies/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')

    expect(screen.getByText(/filtering salary amounts in GBP only/i)).toBeInTheDocument()
  })

  it('renders sort controls with accessible labels, defaulting to the backend default sort', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    const sortFieldSelect = screen.getByLabelText('Sort by')
    const sortOrderSelect = screen.getByLabelText('Sort order')

    for (const field of EMPLOYEE_SORT_FIELDS) {
      expect(within(sortFieldSelect).getByText(field.label)).toBeInTheDocument()
    }
    expect(within(sortOrderSelect).getByText('Ascending')).toBeInTheDocument()
    expect(within(sortOrderSelect).getByText('Descending')).toBeInTheDocument()
    expect(sortFieldSelect).toHaveValue('id')
    expect(sortOrderSelect).toHaveValue('asc')
    expect(screen.queryByRole('button', { name: 'Reset sorting' })).not.toBeInTheDocument()
  })

  it.each(EMPLOYEE_SORT_FIELDS.filter((field) => field.value !== 'id'))(
    'sorts by $label ascending, sending sort_by=$value',
    async ({ value, label }) => {
      const user = userEvent.setup()
      const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

      renderPage()
      await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

      await user.selectOptions(screen.getByLabelText('Sort by'), label)

      await waitFor(() =>
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: value, sortOrder: 'asc' })),
      )
    },
  )

  it('sorts by the default field (Employee record ID) in descending order', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Sort order'), 'Descending')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'id', sortOrder: 'desc' })),
    )
  })

  it('sorts by a chosen field in descending order', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')
    await user.selectOptions(screen.getByLabelText('Sort order'), 'Descending')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'last_name', sortOrder: 'desc' }),
      ),
    )
  })

  it('combines sorting with search, preserving the search term', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Lovel', sortBy: 'last_name', sortOrder: 'asc' }),
      ),
    )
  })

  it('combines sorting with department and country filters', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await user.selectOptions(screen.getByLabelText('Country'), 'United Kingdom')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Department')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          department: 'Engineering',
          country: 'United Kingdom',
          sortBy: 'department',
          sortOrder: 'asc',
        }),
      ),
    )
  })

  it('combines sorting with a salary-range filter', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Currency')

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.click(screen.getByRole('button', { name: 'Apply salary filter' }))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'First name')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          currency: 'GBP',
          minSalary: '50000',
          sortBy: 'first_name',
          sortOrder: 'asc',
        }),
      ),
    )
  })

  it('resets sorting to the default via "Reset sorting", omitting sort query parameters', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Reset sorting' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')
    await user.selectOptions(screen.getByLabelText('Sort order'), 'Descending')
    expect(screen.getByRole('button', { name: 'Reset sorting' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset sorting' }))

    await waitFor(() => {
      const lastCallArgs = spy.mock.calls[spy.mock.calls.length - 1][0]
      expect(lastCallArgs?.sortBy).toBeUndefined()
      expect(lastCallArgs?.sortOrder).toBeUndefined()
    })
    expect(screen.getByLabelText('Sort by')).toHaveValue('id')
    expect(screen.getByLabelText('Sort order')).toHaveValue('asc')
    expect(screen.queryByRole('button', { name: 'Reset sorting' })).not.toBeInTheDocument()
  })

  it('preserves other active filters when sorting is reset to default', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValue(oneEmployeeResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')

    await user.click(screen.getByRole('button', { name: 'Reset sorting' }))

    await waitFor(() => {
      const lastCallArgs = spy.mock.calls[spy.mock.calls.length - 1][0]
      expect(lastCallArgs?.department).toBe('Engineering')
      expect(lastCallArgs?.sortBy).toBeUndefined()
    })
    expect(screen.getByLabelText('Department')).toHaveValue('Engineering')
  })

  it('clearly communicates the active sort field and direction', async () => {
    const user = userEvent.setup()
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    expect(screen.getByText(/sorted by employee record id \(ascending\)/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')
    await user.selectOptions(screen.getByLabelText('Sort order'), 'Descending')

    expect(screen.getByText(/sorted by last name \(descending\)/i)).toBeInTheDocument()
  })

  it('shows an accessible loading state while a sort-triggered request is pending', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockReturnValueOnce(new Promise(() => {}))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('shows a safe, accessible error state when a sort-triggered request fails', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(fullListResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    spy.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('requests the first page with the default page size on initial load', async () => {
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }))
  })

  it('renders accessible pagination controls showing the current page and total', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    expect(screen.getByRole('navigation', { name: 'Employee list pagination' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument()
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
    expect(screen.getByText(/45 employees total/i)).toBeInTheDocument()
  })

  it('disables the Previous button on the first page', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled()
  })

  it('disables the Next button when there is no next page', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(lastPageOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled()
  })

  it('navigates to the next page, sending the correct page number', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    spy.mockResolvedValueOnce(pageTwoOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 20 })),
    )
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument()
  })

  it('navigates back to the previous page, sending the correct page number', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    spy.mockResolvedValueOnce(pageTwoOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument())

    spy.mockResolvedValueOnce(pageOneOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 20 })),
    )
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('preserves active search and filters while navigating between pages', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValue(pageOneOfManyResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')

    spy.mockResolvedValueOnce(pageTwoOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Lovel', department: 'Engineering', page: 2 }),
      ),
    )
  })

  it('preserves active sorting while navigating between pages', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    spy.mockResolvedValue(pageOneOfManyResponse)
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')

    spy.mockResolvedValueOnce(pageTwoOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'last_name', sortOrder: 'asc', page: 2 }),
      ),
    )
  })

  it('resets the page to 1 when search changes', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    spy.mockResolvedValueOnce(pageTwoOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument())

    spy.mockResolvedValue(pageOneOfManyResponse)
    await user.type(screen.getByLabelText('Search employees'), 'Lovel')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Lovel', page: 1 })),
    )
  })

  it('resets the page to 1 when a filter changes', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())
    await screen.findByLabelText('Department')

    spy.mockResolvedValueOnce(pageTwoOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument())

    spy.mockResolvedValue(pageOneOfManyResponse)
    await user.selectOptions(screen.getByLabelText('Department'), 'Engineering')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ department: 'Engineering', page: 1 }),
      ),
    )
  })

  it('resets the page to 1 when sorting changes', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    spy.mockResolvedValueOnce(pageTwoOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument())

    spy.mockResolvedValue(pageOneOfManyResponse)
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Last name')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'last_name', page: 1 })),
    )
  })

  it('resets the page to 1 when the page size changes', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    spy.mockResolvedValueOnce(pageTwoOfManyResponse)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument())

    spy.mockResolvedValue({ ...pageOneOfManyResponse, page_size: 50 })
    await user.selectOptions(screen.getByLabelText('Employees per page'), '50')

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 50 })),
    )
  })

  it('never offers a page size greater than the backend maximum of 100', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    const pageSizeSelect = screen.getByLabelText('Employees per page') as HTMLSelectElement
    const values = Array.from(pageSizeSelect.options).map((option) => Number(option.value))
    expect(Math.max(...values)).toBeLessThanOrEqual(100)
  })

  it('shows disabled pagination controls and a zero count when there are no matching employees', async () => {
    vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(emptyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText(/no employees found/i)).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByText(/0 employees total/i)).toBeInTheDocument()
  })

  it('shows an accessible error state when a page-navigation request fails', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    spy.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'))
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('shows an accessible loading state while a page-navigation request is pending', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(employeesApi, 'fetchEmployees').mockResolvedValue(pageOneOfManyResponse)

    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())

    spy.mockReturnValueOnce(new Promise(() => {}))
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })
})
