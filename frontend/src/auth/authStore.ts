/**
 * Holds the PayScope API access token (the backend's actual auth mechanism:
 * a single shared `Authorization: Bearer <token>` credential checked by
 * `require_api_token`, see `backend/app/api/v1/dependencies.py` — there is
 * no login endpoint, session, or user database). Framework-agnostic so both
 * React (`../auth/AuthContext.tsx`) and the plain API client
 * (`../api/client.ts`) can read/update it without a circular dependency on
 * React itself.
 *
 * The token lives only in `sessionStorage` (cleared when the tab closes) —
 * never hard-coded, never committed. If storage is unavailable (e.g.
 * private browsing), reads/writes fail silently and the app simply behaves
 * as unauthenticated.
 */

const STORAGE_KEY = 'payscope.authToken'

const listeners = new Set<() => void>()

let sessionExpired = false

function readToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token)
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // sessionStorage unavailable; auth state won't persist across reloads this session.
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

/** The current access token, or `null` if the user isn't authenticated. */
export function getToken(): string | null {
  return readToken()
}

/** Whether the last cleared token was due to the backend rejecting it (401), not an explicit sign-out. */
export function getSessionExpired(): boolean {
  return sessionExpired
}

/** Stores a user-supplied access token, authenticating the app. */
export function setToken(token: string): void {
  sessionExpired = false
  writeToken(token)
  notify()
}

/** Explicit user sign-out: clears the token without flagging it as a session expiry. */
export function logout(): void {
  sessionExpired = false
  writeToken(null)
  notify()
}

/** Clears the token because the backend rejected it (401), flagging why for the login screen. */
export function expireSession(): void {
  sessionExpired = true
  writeToken(null)
  notify()
}

/** Subscribes to token/session-expiry changes; returns an unsubscribe function. */
export function subscribeToToken(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
