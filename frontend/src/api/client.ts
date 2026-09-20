import type { ApiErrorPayload } from '../types/api'

/**
 * Backend origin, configured once via `VITE_API_BASE_URL` (see `.env.example`)
 * instead of being hard-coded or repeated per API module.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

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
 * directly, so base URL, JSON handling, and error normalization live in one
 * place.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
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
