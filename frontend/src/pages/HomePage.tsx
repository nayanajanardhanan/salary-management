import { Link } from 'react-router-dom'
import { ChartIcon, ChevronRightIcon, UsersIcon } from '../components/common/icons'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const FEATURES = [
  {
    to: '/employees',
    icon: UsersIcon,
    title: 'Employees',
    description: 'Search, filter, sort, and manage every employee and their current salary record.',
  },
  {
    to: '/analytics',
    icon: ChartIcon,
    title: 'Analytics',
    description: 'Overall and grouped salary statistics by department and country, per currency.',
  },
]

export function HomePage() {
  useDocumentTitle('PayScope')

  return (
    <section aria-labelledby="home-heading">
      <div className="home-hero">
        <div className="home-hero__content">
          <span className="page-header__eyebrow">Welcome back</span>
          <h1 id="home-heading">PayScope</h1>
          <p>
            Employee salary management for HR managers — search and manage employee records, keep
            salary data accurate, and review compensation analytics across departments and countries.
          </p>
          <div className="home-hero__actions">
            <Link to="/employees" className="btn btn-primary">
              <UsersIcon width={16} height={16} />
              View employees
            </Link>
            <Link to="/analytics" className="btn">
              <ChartIcon width={16} height={16} />
              View analytics
            </Link>
          </div>
        </div>
        <ChartIcon className="home-hero__watermark" aria-hidden="true" width={160} height={160} />
      </div>

      <div className="feature-grid">
        {FEATURES.map(({ to, icon: Icon, title, description }) => (
          <Link to={to} className="feature-card" key={to}>
            <span className="feature-card__icon" aria-hidden="true">
              <Icon width={22} height={22} />
            </span>
            <span className="feature-card__title">
              {title}
              <ChevronRightIcon width={18} height={18} aria-hidden="true" />
            </span>
            <p className="feature-card__desc">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
