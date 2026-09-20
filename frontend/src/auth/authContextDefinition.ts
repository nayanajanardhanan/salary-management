import { createContext } from 'react'

export interface AuthContextValue {
  /** Whether an access token is currently stored (see `authStore.ts`). */
  isAuthenticated: boolean
  /** True right after the backend rejected a request with 401, cleared on the next login attempt. */
  sessionExpired: boolean
  /** Authenticates the app with a user-supplied access token. */
  login: (token: string) => void
  /** Clears the access token and returns the app to the unauthenticated state. */
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
