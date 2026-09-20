import { afterEach, describe, expect, it, vi } from 'vitest'
import { logout, setToken } from '../auth/authStore'
import { fetchSalaryStatistics } from './analytics'

const emptyStatistics = {
  overall: [],
  by_department: [],
  by_country: [],
}

describe('fetchSalaryStatistics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  it('requests the salary statistics endpoint', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyStatistics), { status: 200 }))

    const result = await fetchSalaryStatistics()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/analytics\/salary$/)
    expect(result).toEqual(emptyStatistics)
  })

  it('uses the shared authenticated client, attaching the stored access token', async () => {
    setToken('test-token')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyStatistics), { status: 200 }))

    await fetchSalaryStatistics()

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })

  it('includes the department, country, and currency query parameters when given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyStatistics), { status: 200 }))

    await fetchSalaryStatistics({ department: 'Engineering', country: 'United Kingdom', currency: 'GBP' })

    const [requestUrl] = fetchMock.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.pathname).toMatch(/\/api\/v1\/analytics\/salary$/)
    expect(url.searchParams.get('department')).toBe('Engineering')
    expect(url.searchParams.get('country')).toBe('United Kingdom')
    expect(url.searchParams.get('currency')).toBe('GBP')
  })

  it('omits the department, country, and currency query parameters when not given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyStatistics), { status: 200 }))

    await fetchSalaryStatistics()

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/analytics\/salary$/)
  })

  it('omits a query parameter that is given as an empty string', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(emptyStatistics), { status: 200 }))

    await fetchSalaryStatistics({ department: '', country: '', currency: '' })

    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/analytics\/salary$/)
  })
})
