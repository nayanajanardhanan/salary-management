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
 * Application shell: skip link, top navigation bar, and the main landmark
 * pages render into via `<Outlet />`. Only reachable while authenticated
 * (see `ProtectedRoute`), so the sign-out control lives here rather than
 * being duplicated on every page.
 *
 * The nav links and account/sign-out control are each rendered exactly
 * once — on narrow screens CSS alone repositions them into a dropdown
 * below the bar (toggled by `isNavOpen`'s `is-open` class) rather than
 * rendering a second, mobile-only copy, so there's never more than one
 * "Sign out" control or one "Analytics" link in the DOM at a time.
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

      <div className="sidebar__topbar">
        <span className="sidebar__topbar-brand">
          <span className="sidebar__brand-mark" aria-hidden="true">
            <ChartIcon width={18} height={18} />
          </span>
          <span className="sidebar__brand-name">PayScope</span>
        </span>

        <button
          type="button"
          className="sidebar__menu-button"
          onClick={() => setIsNavOpen((open) => !open)}
          aria-label={isNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isNavOpen}
        >
          {isNavOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {isNavOpen && (
        <button
          type="button"
          className="sidebar__backdrop"
          onClick={() => setIsNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar${isNavOpen ? ' is-open' : ''}`}>
        <span className="sidebar__brand">
          <span className="sidebar__brand-mark" aria-hidden="true">
            <ChartIcon width={18} height={18} />
          </span>
          <span className="sidebar__brand-name">PayScope</span>
        </span>

        <nav className="sidebar__nav" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="sidebar__link">
                  <Icon width={18} height={18} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__account">
            <span className="sidebar__avatar" aria-hidden="true">
              HR
            </span>
            <span className="sidebar__account-text">
              <span className="sidebar__account-role">HR Manager</span>
              <span className="sidebar__account-sub">Signed in</span>
            </span>
            <button
              type="button"
              className="sidebar__signout"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOutIcon width={17} height={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <main id="main-content" className="app-content" tabIndex={-1}>
          <div className="page-container">
            <div className="page-transition" key={location.pathname}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
