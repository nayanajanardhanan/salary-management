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

      <header className={`app-header${isNavOpen ? ' is-open' : ''}`}>
        <div className="app-header__bar">
          <span className="app-header__brand">
            <span className="app-header__brand-mark" aria-hidden="true">
              <ChartIcon width={18} height={18} />
            </span>
            <span className="app-header__brand-name">PayScope</span>
          </span>

          <button
            type="button"
            className="app-header__menu-button"
            onClick={() => setIsNavOpen((open) => !open)}
            aria-label={isNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isNavOpen}
          >
            {isNavOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <nav className="app-header__nav" aria-label="Primary">
            <ul>
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className="app-header__link">
                    <Icon width={17} height={17} />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="app-header__account">
            <span className="app-header__avatar" aria-hidden="true">
              HR
            </span>
            <span className="app-header__account-text">
              <span className="app-header__account-role">HR Manager</span>
              <span className="app-header__account-sub">Signed in</span>
            </span>
            <button
              type="button"
              className="app-header__signout"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOutIcon width={17} height={17} />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="app-content" tabIndex={-1}>
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
