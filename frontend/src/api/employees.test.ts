import { afterEach, describe, expect, it, vi } from 'vitest'
import { logout, setToken } from '../auth/authStore'
import { fetchEmployees } from './employees'

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
})
