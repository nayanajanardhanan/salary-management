import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

/**
 * Route guard: renders its nested routes (`<Outlet />`) only when
 * authenticated, otherwise redirects to `/login`. Centralizes the
 * "is the user allowed here" check in one place rather than each protected
 * page checking `useAuth()` itself.
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
