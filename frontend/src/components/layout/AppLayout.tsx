import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ChartIcon, HomeIcon, LogOutIcon, MenuIcon, CloseIcon, UsersIcon } from '../common/icons'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/employees', label: 'Employees', icon: UsersIcon, end: false },
  { to: '/analytics', label: 'Analytics', icon: ChartIcon, end: false },
]

/**
 * Application shell: skip link, sidebar/mobile nav, and the main landmark
 * pages render into via `<Outlet />`. Only reachable while authenticated
 * (see `ProtectedRoute`), so the sign-out control lives here rather than
 * being duplicated on every page.
 */
export function AppLayout() {
  const { logout } = useAuth()
  const location = useLocation()
  const [isNavOpen, setIsNavOpen] = useState(false)

  useEffect(() => {
    setIsNavOpen(false)
  }, [location.pathname])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <div
        className={`app-sidebar-backdrop${isNavOpen ? ' is-open' : ''}`}
        onClick={() => setIsNavOpen(false)}
        aria-hidden="true"
      />

      <aside className={`app-sidebar${isNavOpen ? ' is-open' : ''}`} aria-label="Sidebar">
        <div className="app-sidebar__brand">
          <span className="app-sidebar__brand-mark" aria-hidden="true">
            <ChartIcon width={20} height={20} />
          </span>
          <span className="app-sidebar__brand-text">
            <span className="app-sidebar__brand-name">PayScope</span>
            <span className="app-sidebar__brand-tagline">Salary management</span>
          </span>
          <button
            type="button"
            className="app-sidebar__close"
            onClick={() => setIsNavOpen(false)}
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>

        <nav aria-label="Primary">
          <ul>
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="app-sidebar__link">
                  <Icon />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="app-sidebar__footer">
          <div className="app-sidebar__account">
            <span className="app-sidebar__avatar" aria-hidden="true">
              HR
            </span>
            <span className="app-sidebar__account-text">
              <span className="app-sidebar__account-role">HR Manager</span>
              <span className="app-sidebar__account-sub">Signed in</span>
            </span>
          </div>
          <button
            type="button"
            className="app-sidebar__signout"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOutIcon />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="app-topbar__menu-button"
            onClick={() => setIsNavOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
          <span className="app-topbar__brand">
            <span className="app-topbar__brand-mark" aria-hidden="true">
              <ChartIcon width={16} height={16} />
            </span>
            PayScope
          </span>
        </header>

        <main id="main-content" className="app-content" tabIndex={-1}>
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
