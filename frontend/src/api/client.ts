import { expireSession, getToken } from '../auth/authStore'
import type { ApiErrorPayload } from '../types/api'

/**
 * Backend origin, configured once via `VITE_API_BASE_URL` (see `.env.example`)
 * instead of being hard-coded or repeated per API module.
 *
 * `VITE_API_BASE_URL` is resolved by Vite at *build* time (it's baked into
 * the bundle, not read at container/server runtime — see
 * `frontend/README.md` and `docs/deployment.md`). The `localhost:8000`
 * fallback only applies to `import.meta.env.DEV` (the Vite dev server,
 * `npm run dev`), so local development stays zero-config; a real build
 * (`npm run build`, or the Docker image build) fails loudly instead of
 * silently shipping a `localhost` URL that could never work outside a
 * developer's own machine.
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (configured) {
    return configured
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8000'
  }
  throw new Error(
    'VITE_API_BASE_URL is not set. It must be provided at build time for ' +
      'anything other than `npm run dev` (e.g. `npm run build`, or ' +
      '`docker build --build-arg VITE_API_BASE_URL=...`). See frontend/README.md.',
  )
}

export const API_BASE_URL = resolveApiBaseUrl()

/** A failed request, normalized from the backend's `{error: {code, message, details}}` envelope. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * Shared fetch wrapper: every resource-specific API module (added alongside
 * the feature that needs it) builds on this instead of calling `fetch`
 * directly, so base URL, JSON handling, authentication, and error
 * normalization all live in one place — pages/components never attach the
 * `Authorization` header or interpret a 401 themselves.
 *
 * The stored access token (see `../auth/authStore.ts`) is attached
 * automatically when present, exactly as the backend's `require_auth`
 * dependency expects (`Authorization: Bearer <token>`). A `401` response
 * means the backend rejected the token — it's cleared centrally here
 * (`expireSession`), which flips the whole app to the unauthenticated state
 * via `AuthContext`, without every call site having to handle it.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      // Only a 401 to a request that *carried* a token means the backend
      // rejected an established session; a 401 with no token (e.g. a
      // failed login attempt) is just that call's own failure, not an
      // expired session.
      expireSession()
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null
    throw new ApiError(
      response.status,
      payload?.error.code ?? 'UNKNOWN_ERROR',
      payload?.error.message ?? 'Something went wrong. Please try again.',
      payload?.error.details ?? null,
    )
  }

  return (await response.json()) as T
}
