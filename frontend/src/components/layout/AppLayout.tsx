import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

/**
 * Application shell: skip link, header/nav, and the main landmark pages
 * render into via `<Outlet />`. Only reachable while authenticated (see
 * `ProtectedRoute`), so the sign-out control lives here rather than being
 * duplicated on every page.
 */
export function AppLayout() {
  const { logout } = useAuth()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <span className="app-header__brand">PayScope</span>
        <nav aria-label="Primary">
          <ul>
            <li>
              <NavLink to="/" end>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/employees">Employees</NavLink>
            </li>
          </ul>
        </nav>
        <button type="button" className="app-header__signout" onClick={logout}>
          Sign out
        </button>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
