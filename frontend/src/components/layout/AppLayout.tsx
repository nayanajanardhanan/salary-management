import { NavLink, Outlet } from 'react-router-dom'

/**
 * Application shell: skip link, header/nav, and the main landmark pages
 * render into via `<Outlet />`. Navigation links are added here as routed
 * pages are introduced by future feature commits.
 */
export function AppLayout() {
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
          </ul>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
