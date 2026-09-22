import { afterEach, describe, expect, it, vi } from 'vitest'
import { logout } from '../auth/authStore'
import { login } from './auth'

const tokenResponse = { access_token: 'issued-token', token_type: 'bearer', expires_in: 3600 }

describe('login', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    logout()
  })

  it('POSTs to the login endpoint with the given credentials', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(tokenResponse), { status: 200 }))

    const result = await login({ username_or_email: 'hr.admin', password: 'correct-password' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toMatch(/\/api\/v1\/auth\/login$/)
    expect(requestInit?.method).toBe('POST')
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      username_or_email: 'hr.admin',
      password: 'correct-password',
    })
    expect(result).toEqual(tokenResponse)
  })

  it('sends no Authorization header — there is no token yet at login time', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(tokenResponse), { status: 200 }))

    await login({ username_or_email: 'hr.admin', password: 'correct-password' })

    const [, requestInit] = fetchMock.mock.calls[0]
    const headers = new Headers(requestInit?.headers)
    expect(headers.has('Authorization')).toBe(false)
  })

  it('throws a normalized ApiError for incorrect credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Incorrect username/email or password.',
            details: null,
          },
        }),
        { status: 401 },
      ),
    )

    await expect(
      login({ username_or_email: 'hr.admin', password: 'wrong-password' }),
    ).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    })
  })
})
