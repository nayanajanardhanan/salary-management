import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../../src/api/client'
import { getSessionExpired, getToken, logout, setToken } from '../../src/auth/authStore'

describe('apiRequest', () => {
  beforeEach(() => {
    logout()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    logout()
  })

  it('returns parsed JSON on a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest<{ status: string }>('/health')

    expect(result).toEqual({ status: 'ok' })
  })

  it('throws a normalized ApiError using the backend error envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee 1 not found', details: null } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/v1/employees/1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'EMPLOYEE_NOT_FOUND',
      message: 'Employee 1 not found',
    } satisfies Partial<ApiError>)
  })

  it('throws a network ApiError when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    await expect(apiRequest('/health')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NETWORK_ERROR',
    } satisfies Partial<ApiError>)
  })

  it('attaches the stored token as a Bearer Authorization header', async () => {
    setToken('stored-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/api/v1/employees')

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(requestInit.headers)
    expect(headers.get('Authorization')).toBe('Bearer stored-token')
  })

  it('sends no Authorization header when no token is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/health')

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(requestInit.headers)
    expect(headers.has('Authorization')).toBe(false)
  })

  it('clears the stored auth token when the backend responds 401', async () => {
    setToken('stored-token')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication credentials.', details: null } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/v1/employees')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    } satisfies Partial<ApiError>)

    expect(getToken()).toBeNull()
    expect(getSessionExpired()).toBe(true)
  })
})
