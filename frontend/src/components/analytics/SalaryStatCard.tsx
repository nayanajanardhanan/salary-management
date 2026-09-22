import type { CurrencySalaryStats } from '../../types/analytics'
import { formatSalaryAmount } from '../../utils/formatting'

interface SalaryStatCardProps {
  stats: CurrencySalaryStats
}

/**
 * One currency's overall salary statistics — count, average, minimum,
 * maximum — reused for every currency present in `SalaryStatistics.overall`
 * (`AnalyticsPage` renders one card per currency, never a combined figure
 * across currencies, `docs/requirements.md` Section 5). Uses
 * `formatSalaryAmount` (shared with the employee table/details page) so
 * every amount is self-contained with its own currency code, not just
 * implied by the card's heading.
 */
export function SalaryStatCard({ stats }: SalaryStatCardProps) {
  return (
    <div className="salary-stat-card" role="group" aria-label={`Salary statistics in ${stats.currency}`}>
      <h3 className="salary-stat-card__currency">{stats.currency}</h3>
      <dl>
        <div>
          <dt>Salary records</dt>
          <dd>{stats.count.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Average salary</dt>
          <dd>{formatSalaryAmount(stats.average, stats.currency)}</dd>
        </div>
        <div>
          <dt>Minimum salary</dt>
          <dd>{formatSalaryAmount(stats.minimum, stats.currency)}</dd>
        </div>
        <div>
          <dt>Maximum salary</dt>
          <dd>{formatSalaryAmount(stats.maximum, stats.currency)}</dd>
        </div>
      </dl>
    </div>
  )
}
