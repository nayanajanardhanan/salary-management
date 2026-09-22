import { apiRequest } from './client'
import type { LoginRequest, LoginResponse } from '../types/auth'

const LOGIN_ENDPOINT = '/api/v1/auth/login'

/**
 * Exchanges a username/email + password for an access token, via the shared
 * `apiRequest` client (`./client.ts`) like every other API module — no
 * token is attached to this particular call (there isn't one yet), but the
 * same JSON handling and error normalization apply. A `401`
 * (`error.code === 'INVALID_CREDENTIALS'`) covers an unknown username/email,
 * a wrong password, and an inactive user alike — the backend never reveals
 * which — and a `422` (`error.code === 'VALIDATION_ERROR'`) covers a missing
 * field. Both surface as the same normalized `ApiError` every other endpoint
 * throws (`hooks/useLogin.ts` interprets it). `password` is never logged by
 * this module or the backend.
 */
export function login(data: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>(LOGIN_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
