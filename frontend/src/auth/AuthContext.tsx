import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './authContextDefinition'
import * as authStore from './authStore'

/**
 * Single source of truth for authentication state, so pages/components read
 * it via `useAuth()` (`./useAuth.ts`) instead of each re-implementing token
 * checks. Wraps `authStore` (framework-agnostic) with `useSyncExternalStore`
 * so React re-renders when the token changes anywhere — including when the
 * shared API client (`../api/client.ts`) clears it after a 401.
 *
 * `login` takes the access token already returned by a successful
 * `POST /api/v1/auth/login` (see `../hooks/useLogin.ts`, which calls it) —
 * it doesn't itself talk to the backend or validate credentials.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(authStore.subscribeToToken, authStore.getToken)
  const sessionExpired = useSyncExternalStore(authStore.subscribeToToken, authStore.getSessionExpired)

  const login = useCallback((nextToken: string) => {
    authStore.setToken(nextToken)
  }, [])

  const logout = useCallback(() => {
    authStore.logout()
  }, [])

  const value: AuthContextValue = {
    isAuthenticated: token !== null,
    sessionExpired,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
