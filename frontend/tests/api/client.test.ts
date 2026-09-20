import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../../src/api/client'

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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
})
