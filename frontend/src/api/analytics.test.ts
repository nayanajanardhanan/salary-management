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
})
