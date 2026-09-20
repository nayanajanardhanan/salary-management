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
})
