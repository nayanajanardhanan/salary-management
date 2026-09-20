import { afterEach, describe, expect, it, vi } from 'vitest'
import { logout, setToken } from '../auth/authStore'
import { fetchEmployeeDetails, fetchEmployees } from './employees'

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
