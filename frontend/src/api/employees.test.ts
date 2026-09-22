import { afterEach, describe, expect, it, vi } from 'vitest'
import { logout, setToken } from '../auth/authStore'
import {
  createEmployee,
  createEmployeeSalary,
  deleteEmployeeSalary,
  fetchEmployee,
  fetchEmployeeDetails,
  fetchEmployees,
  updateEmployeeSalary,
} from './employees'
import type { EmployeeCreate, EmployeeRead, SalaryCreate, SalaryUpdate } from '../types/employee'

const emptyResponse = {
  items: [],
  page: 1,
  page_size: 20,
  total: 0,
  has_next: false,
}

describe('fetchEmployees', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  it('requests the employee listing endpoint with no extra query parameters', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    const result = await fetchEmployees()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees$/)
    expect(result).toEqual(emptyResponse)
  })

  it('uses the shared authenticated client, attaching the stored access token', async () => {
    setToken('test-token')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees()

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })

  it('includes the search query parameter when a search value is given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ search: 'Ada' })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.pathname).toMatch(/\/api\/v1\/employees$/)
    expect(url.searchParams.get('search')).toBe('Ada')
  })

  it('omits the search query parameter when no search value is given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ search: '' })

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees$/)
  })

  it('includes the department query parameter when a department value is given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ department: 'Engineering' })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('department')).toBe('Engineering')
  })

  it('includes the country query parameter when a country value is given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ country: 'United Kingdom' })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('country')).toBe('United Kingdom')
  })

  it('combines search, department, and country query parameters when all are given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ search: 'Ada', department: 'Engineering', country: 'United Kingdom' })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('search')).toBe('Ada')
    expect(url.searchParams.get('department')).toBe('Engineering')
    expect(url.searchParams.get('country')).toBe('United Kingdom')
  })

  it('omits the department and country query parameters when they are empty', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ department: '', country: '' })

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees$/)
  })

  it('includes the currency, min_salary, and max_salary query parameters when given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ currency: 'GBP', minSalary: '50000', maxSalary: '100000' })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('currency')).toBe('GBP')
    expect(url.searchParams.get('min_salary')).toBe('50000')
    expect(url.searchParams.get('max_salary')).toBe('100000')
  })

  it('omits the currency, min_salary, and max_salary query parameters when they are empty', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ currency: '', minSalary: '', maxSalary: '' })

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees$/)
  })

  it('combines search, department, country, and salary-range query parameters when all are given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({
      search: 'Ada',
      department: 'Engineering',
      country: 'United Kingdom',
      currency: 'GBP',
      minSalary: '50000',
      maxSalary: '100000',
    })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('search')).toBe('Ada')
    expect(url.searchParams.get('department')).toBe('Engineering')
    expect(url.searchParams.get('country')).toBe('United Kingdom')
    expect(url.searchParams.get('currency')).toBe('GBP')
    expect(url.searchParams.get('min_salary')).toBe('50000')
    expect(url.searchParams.get('max_salary')).toBe('100000')
  })

  it('includes the sort_by and sort_order query parameters when given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ sortBy: 'last_name', sortOrder: 'desc' })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('sort_by')).toBe('last_name')
    expect(url.searchParams.get('sort_order')).toBe('desc')
  })

  it('omits the sort_by and sort_order query parameters when not given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees()

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees$/)
  })

  it('combines sorting with search and filter query parameters', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({
      search: 'Ada',
      department: 'Engineering',
      currency: 'GBP',
      minSalary: '50000',
      sortBy: 'department',
      sortOrder: 'asc',
    })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('search')).toBe('Ada')
    expect(url.searchParams.get('department')).toBe('Engineering')
    expect(url.searchParams.get('currency')).toBe('GBP')
    expect(url.searchParams.get('min_salary')).toBe('50000')
    expect(url.searchParams.get('sort_by')).toBe('department')
    expect(url.searchParams.get('sort_order')).toBe('asc')
  })

  it('includes the page and page_size query parameters when given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({ page: 2, pageSize: 50 })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('page_size')).toBe('50')
  })

  it('omits the page and page_size query parameters when not given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees()

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees$/)
  })

  it('combines pagination with search, filter, and sort query parameters', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyResponse), { status: 200 }))

    await fetchEmployees({
      search: 'Ada',
      department: 'Engineering',
      sortBy: 'last_name',
      sortOrder: 'desc',
      page: 3,
      pageSize: 10,
    })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('search')).toBe('Ada')
    expect(url.searchParams.get('department')).toBe('Engineering')
    expect(url.searchParams.get('sort_by')).toBe('last_name')
    expect(url.searchParams.get('sort_order')).toBe('desc')
    expect(url.searchParams.get('page')).toBe('3')
    expect(url.searchParams.get('page_size')).toBe('10')
  })
})

describe('fetchEmployeeDetails', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  const detailsResponse = {
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

  it('requests the details endpoint for the given employee id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(detailsResponse), { status: 200 }))

    const result = await fetchEmployeeDetails(1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/1\/details$/)
    expect(result).toEqual(detailsResponse)
  })

  it('uses a different employee id when given a different id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(detailsResponse), { status: 200 }))

    await fetchEmployeeDetails(42)

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/42\/details$/)
  })

  it('uses the shared authenticated client, attaching the stored access token', async () => {
    setToken('test-token')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(detailsResponse), { status: 200 }))

    await fetchEmployeeDetails(1)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })
})

describe('createEmployee', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  const newEmployee: EmployeeCreate = {
    employee_code: 'EMP-010',
    first_name: 'Grace',
    last_name: 'Hopper',
    department: 'Research',
    country: 'United States',
    job_title: 'Rear Admiral',
    employment_status: 'active',
  }

  const createdEmployeeResponse = {
    id: 10,
    ...newEmployee,
  }

  it('posts to the employees endpoint with the given payload', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(createdEmployeeResponse), { status: 201 }))

    const result = await createEmployee(newEmployee)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees$/)
    expect(requestInit?.method).toBe('POST')
    expect(JSON.parse(String(requestInit?.body))).toEqual(newEmployee)
    expect(result).toEqual(createdEmployeeResponse)
  })

  it('sends a JSON content type header', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(createdEmployeeResponse), { status: 201 }))

    await createEmployee(newEmployee)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('uses the shared authenticated client, attaching the stored access token', async () => {
    setToken('test-token')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(createdEmployeeResponse), { status: 201 }))

    await createEmployee(newEmployee)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })
})

describe('fetchEmployee', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  const employeeResponse: EmployeeRead = {
    id: 1,
    employee_code: 'EMP-001',
    first_name: 'Ada',
    last_name: 'Lovelace',
    department: 'Engineering',
    country: 'United Kingdom',
    job_title: 'Software Engineer',
    employment_status: 'active',
  }

  it('requests the single employee endpoint for the given id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(employeeResponse), { status: 200 }))

    const result = await fetchEmployee(1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/1$/)
    expect(result).toEqual(employeeResponse)
  })

  it('uses a different employee id when given a different id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ...employeeResponse, id: 42 }), { status: 200 }))

    await fetchEmployee(42)

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/42$/)
  })

  it('uses the shared authenticated client, attaching the stored access token', async () => {
    setToken('test-token')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(employeeResponse), { status: 200 }))

    await fetchEmployee(1)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })
})

describe('createEmployeeSalary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  const newSalary: SalaryCreate = { amount: '95000.00', currency: 'GBP' }
  const createdSalaryResponse = { employee_id: 1, ...newSalary }

  it('posts to the employee salary endpoint for the given employee id, with the given payload', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(createdSalaryResponse), { status: 201 }))

    const result = await createEmployeeSalary(1, newSalary)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/1\/salary$/)
    expect(requestInit?.method).toBe('POST')
    expect(JSON.parse(String(requestInit?.body))).toEqual(newSalary)
    expect(result).toEqual(createdSalaryResponse)
  })

  it('uses a different employee id when given a different id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ...createdSalaryResponse, employee_id: 42 }), { status: 201 }))

    await createEmployeeSalary(42, newSalary)

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/42\/salary$/)
  })

  it('sends a JSON content type header', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(createdSalaryResponse), { status: 201 }))

    await createEmployeeSalary(1, newSalary)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('uses the shared authenticated client, attaching the stored access token', async () => {
    setToken('test-token')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(createdSalaryResponse), { status: 201 }))

    await createEmployeeSalary(1, newSalary)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })
})

describe('updateEmployeeSalary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  const salaryUpdate: SalaryUpdate = { amount: '105000.00', currency: 'USD' }
  const updatedSalaryResponse = { employee_id: 1, ...salaryUpdate }

  it('puts to the employee salary endpoint for the given employee id, with the given payload', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(updatedSalaryResponse), { status: 200 }))

    const result = await updateEmployeeSalary(1, salaryUpdate)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/1\/salary$/)
    expect(requestInit?.method).toBe('PUT')
    expect(JSON.parse(String(requestInit?.body))).toEqual(salaryUpdate)
    expect(result).toEqual(updatedSalaryResponse)
  })

  it('uses a different employee id when given a different id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ...updatedSalaryResponse, employee_id: 42 }), { status: 200 }))

    await updateEmployeeSalary(42, salaryUpdate)

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/42\/salary$/)
  })

  it('sends a JSON content type header', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(updatedSalaryResponse), { status: 200 }))

    await updateEmployeeSalary(1, salaryUpdate)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('uses the shared authenticated client, attaching the stored access token', async () => {
    setToken('test-token')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(updatedSalaryResponse), { status: 200 }))

    await updateEmployeeSalary(1, salaryUpdate)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })
})

describe('deleteEmployeeSalary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  it('sends a DELETE request to the employee salary endpoint for the given employee id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    const result = await deleteEmployeeSalary(1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/1\/salary$/)
    expect(requestInit?.method).toBe('DELETE')
    expect(result).toBeUndefined()
  })

  it('uses a different employee id when given a different id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await deleteEmployeeSalary(42)

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/employees\/42\/salary$/)
  })

  it('uses the shared authenticated client, attaching the stored access token', async () => {
    setToken('test-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await deleteEmployeeSalary(1)

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })
})
