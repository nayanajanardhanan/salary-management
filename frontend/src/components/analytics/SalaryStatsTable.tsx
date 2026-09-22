import type { CurrencySalaryStats } from '../../types/analytics'
import { formatPlainAmount } from '../../utils/formatting'

interface SalaryStatsTableProps<T extends CurrencySalaryStats> {
  rows: T[]
  /** Column header and empty-state noun for the group dimension (e.g. "Department", "Country"). */
  groupLabel: string
  /** Extracts the group's display value from a row (e.g. `(row) => row.department`). */
  getGroupValue: (row: T) => string
  caption: string
}

/**
 * Reusable table for salary statistics grouped by one dimension
 * (department or country) — reused by `AnalyticsPage` for both
 * `SalaryStatistics.by_department` and `by_country`, rather than two
 * near-identical tables. One row per group+currency pair, each with its own
 * "Currency" column: a group with salaries in more than one currency gets
 * one row per currency, never a combined figure
 * (`docs/requirements.md` Section 5) — amounts are plain numbers
 * (`formatPlainAmount`) since the currency is already given by that row's
 * own "Currency" cell, right next to it.
 */
export function SalaryStatsTable<T extends CurrencySalaryStats>({
  rows,
  groupLabel,
  getGroupValue,
  caption,
}: SalaryStatsTableProps<T>) {
  if (rows.length === 0) {
    return <p className="salary-stats-table__empty">No {groupLabel.toLowerCase()} statistics available.</p>
  }

  return (
    <div
      className="salary-stats-table-scroll"
      tabIndex={0}
      role="region"
      aria-label={`${caption}, scrollable table`}
    >
      <table className="salary-stats-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{groupLabel}</th>
            <th scope="col">Currency</th>
            <th scope="col">Salary records</th>
            <th scope="col">Average salary</th>
            <th scope="col">Minimum salary</th>
            <th scope="col">Maximum salary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${getGroupValue(row)}-${row.currency}-${index}`}>
              <th scope="row">{getGroupValue(row)}</th>
              <td>{row.currency}</td>
              <td>{row.count.toLocaleString()}</td>
              <td>{formatPlainAmount(row.average)}</td>
              <td>{formatPlainAmount(row.minimum)}</td>
              <td>{formatPlainAmount(row.maximum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
