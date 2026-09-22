import { useMemo, useState } from 'react'
import { AnalyticsFilters } from '../components/analytics/AnalyticsFilters'
import { BarList, type BarListItem } from '../components/analytics/BarList'
import { SalaryStatCard } from '../components/analytics/SalaryStatCard'
import { SalaryStatsTable } from '../components/analytics/SalaryStatsTable'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingRegion, SkeletonCards, SkeletonToolbar } from '../components/common/LoadingIndicator'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployeeFilterOptions } from '../hooks/useEmployeeFilterOptions'
import { useSalaryAnalytics } from '../hooks/useSalaryAnalytics'
import type { CurrencySalaryStats } from '../types/analytics'

/**
 * Sums `count` across rows sharing the same group label (e.g. every
 * currency's rows for one department) — safe because a record count is
 * currency-agnostic (unlike an amount), so adding counts together never
 * combines salary amounts across currencies. Sorted highest-first for the
 * bar chart's ranking.
 */
function aggregateCounts<T extends CurrencySalaryStats>(rows: T[], getLabel: (row: T) => string): BarListItem[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const label = getLabel(row)
    totals.set(label, (totals.get(label) ?? 0) + row.count)
  }
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value, displayValue: value.toLocaleString() }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Salary analytics dashboard (`docs/requirements.md` FR-6.1-FR-6.5):
 * overall statistics per currency, plus the same statistics grouped by
 * department and by country, from the existing `GET /analytics/salary`
 * endpoint (`hooks/useSalaryAnalytics.ts`). Salary history/trend
 * information is out of scope (Section 6.2) — only the current statistics
 * the backend already computes are shown, never combined across
 * currencies (Section 5) and never aggregated client-side.
 */
export function AnalyticsPage() {
  useDocumentTitle('Salary Analytics - PayScope')

  const [department, setDepartment] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('')

  const { data, isLoading, error, retry } = useSalaryAnalytics({ department, country, currency })
  const {
    departments,
    countries,
    currencies,
    isLoading: isLoadingFilterOptions,
    error: filterOptionsError,
  } = useEmployeeFilterOptions()

  function handleClearFilters() {
    setDepartment('')
    setCountry('')
    setCurrency('')
  }

  const hasResults = data !== null && data.overall.length > 0

  const currencyCountItems: BarListItem[] = useMemo(
    () =>
      (data?.overall ?? [])
        .map((stats) => ({ label: stats.currency, value: stats.count, displayValue: stats.count.toLocaleString() }))
        .sort((a, b) => b.value - a.value),
    [data],
  )
  const departmentHeadcountItems = useMemo(
    () => aggregateCounts(data?.by_department ?? [], (row) => row.department),
    [data],
  )
  const countryHeadcountItems = useMemo(() => aggregateCounts(data?.by_country ?? [], (row) => row.country), [data])

  return (
    <section aria-labelledby="analytics-heading">
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">Analytics</span>
          <h1 id="analytics-heading">Salary Analytics</h1>
          <p className="page-header__description">
            Overall and grouped salary statistics — count, average, minimum, and maximum — computed per
            currency, never combined across currencies.
          </p>
        </div>
      </div>

      <AnalyticsFilters
        departments={departments}
        countries={countries}
        currencies={currencies}
        isLoadingOptions={isLoadingFilterOptions}
        optionsError={filterOptionsError}
        department={department}
        country={country}
        currency={currency}
        onDepartmentChange={setDepartment}
        onCountryChange={setCountry}
        onCurrencyChange={setCurrency}
        onClearAll={handleClearFilters}
      />

      {isLoading ? (
        <LoadingRegion label="Loading salary analytics…">
          <SkeletonToolbar />
          <SkeletonCards count={3} />
        </LoadingRegion>
      ) : error ? (
        <ErrorMessage message={error} onRetry={retry} />
      ) : hasResults && data ? (
        <>
          <section aria-labelledby="analytics-overall-heading" className="section-block">
            <h2 id="analytics-overall-heading" className="section-heading">
              Overall
            </h2>
            <div className="analytics-charts-row">
              <BarList title="Salary records by currency" items={currencyCountItems} />
            </div>
            <div className="salary-stat-cards">
              {data.overall.map((stats) => (
                <SalaryStatCard key={stats.currency} stats={stats} />
              ))}
            </div>
          </section>

          <section aria-labelledby="analytics-department-heading" className="section-block">
            <h2 id="analytics-department-heading" className="section-heading">
              By department
            </h2>
            <div className="analytics-charts-row">
              <BarList title="Employees by department" items={departmentHeadcountItems} />
            </div>
            <SalaryStatsTable
              rows={data.by_department}
              groupLabel="Department"
              getGroupValue={(row) => row.department}
              caption="Salary statistics by department"
            />
          </section>

          <section aria-labelledby="analytics-country-heading" className="section-block">
            <h2 id="analytics-country-heading" className="section-heading">
              By country
            </h2>
            <div className="analytics-charts-row">
              <BarList title="Employees by country" items={countryHeadcountItems} />
            </div>
            <SalaryStatsTable
              rows={data.by_country}
              groupLabel="Country"
              getGroupValue={(row) => row.country}
              caption="Salary statistics by country"
            />
          </section>
        </>
      ) : (
        <EmptyState message={describeEmptyAnalytics(department, country, currency)} />
      )}
    </section>
  )
}

/** Builds an accessible, specific "no results" message reflecting whichever filters are active. */
function describeEmptyAnalytics(department: string, country: string, currency: string): string {
  const criteria: string[] = []
  if (department) criteria.push(`department "${department}"`)
  if (country) criteria.push(`country "${country}"`)
  if (currency) criteria.push(`currency "${currency}"`)

  return criteria.length > 0
    ? `No salary records match ${criteria.join(' and ')}.`
    : 'No salary records are available yet.'
}
