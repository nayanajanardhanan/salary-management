import { Link } from 'react-router-dom'
import { ChartIcon, ChevronRightIcon, UsersIcon } from '../components/common/icons'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function HomePage() {
  useDocumentTitle('PayScope')

  return (
    <section aria-labelledby="home-heading">
      <div className="home-hero">
        <span className="page-header__eyebrow">Welcome back</span>
        <h1 id="home-heading">PayScope</h1>
        <p>
          Employee salary management for HR managers — search and manage employee records, keep salary
          data accurate, and review compensation analytics across departments and countries.
        </p>
      </div>

      <div className="stat-grid">
        <Link to="/employees" className="stat-tile">
          <span className="stat-tile__icon" aria-hidden="true">
            <UsersIcon />
          </span>
          <span className="stat-tile__text">
            <span className="stat-tile__value">Employees</span>
            <span className="stat-tile__label">Search, filter, and manage employee records</span>
          </span>
          <ChevronRightIcon width={16} height={16} aria-hidden="true" />
        </Link>

        <Link to="/analytics" className="stat-tile">
          <span className="stat-tile__icon" aria-hidden="true">
            <ChartIcon />
          </span>
          <span className="stat-tile__text">
            <span className="stat-tile__value">Analytics</span>
            <span className="stat-tile__label">Salary statistics by department and country</span>
          </span>
          <ChevronRightIcon width={16} height={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
