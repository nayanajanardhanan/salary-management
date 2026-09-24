import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChartIcon, ChevronRightIcon, GlobeIcon, UsersIcon } from '../components/common/icons'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSalaryAnalytics } from '../hooks/useSalaryAnalytics'

const FEATURES = [
  {
    to: '/employees',
    icon: UsersIcon,
    title: 'Employees',
    description: 'Search, filter, sort, and manage every employee and their current salary record.',
    tone: 'purple' as const,
  },
  {
    to: '/analytics',
    icon: ChartIcon,
    title: 'Analytics',
    description: 'Overall and grouped salary statistics by department and country, per currency.',
    tone: 'teal' as const,
  },
]

export function HomePage() {
  useDocumentTitle('PayScope')

  const { data, isLoading } = useSalaryAnalytics()

  const totalEmployees = useMemo(
    () => (data?.overall ?? []).reduce((sum, row) => sum + row.count, 0),
    [data],
  )
  const departmentCount = useMemo(() => new Set((data?.by_department ?? []).map((row) => row.department)).size, [data])
  const countryCount = useMemo(() => new Set((data?.by_country ?? []).map((row) => row.country)).size, [data])

  const STATS = [
    {
      label: 'Total employees',
      value: totalEmployees,
      description: 'Active employees with a current salary record on file.',
      icon: UsersIcon,
      tone: 'purple' as const,
    },
    {
      label: 'Departments',
      value: departmentCount,
      description: 'Distinct departments represented across the organization.',
      icon: ChartIcon,
      tone: 'teal' as const,
    },
    {
      label: 'Countries',
      value: countryCount,
      description: 'Countries employees are currently based in.',
      icon: GlobeIcon,
      tone: 'pink' as const,
    },
  ]

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

      <div className="dashboard-stats" aria-busy={isLoading}>
        {STATS.map(({ label, value, description, icon: Icon, tone }) => (
          <div className={`dashboard-stat-card dashboard-stat-card--${tone}`} key={label}>
            <span className="dashboard-stat-card__icon" aria-hidden="true">
              <Icon width={20} height={20} />
            </span>
            <span className="dashboard-stat-card__label">{label}</span>
            <span className="dashboard-stat-card__value">{isLoading ? '—' : value.toLocaleString()}</span>
            <p className="dashboard-stat-card__desc">{description}</p>
          </div>
        ))}
      </div>

      <div className="feature-grid">
        {FEATURES.map(({ to, icon: Icon, title, description, tone }) => (
          <Link to={to} className="feature-card" key={to}>
            <span className={`feature-card__icon feature-card__icon--${tone}`} aria-hidden="true">
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
