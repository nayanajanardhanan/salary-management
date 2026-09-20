import { useState } from 'react'
import { AnalyticsFilters } from '../components/analytics/AnalyticsFilters'
import { SalaryStatCard } from '../components/analytics/SalaryStatCard'
import { SalaryStatsTable } from '../components/analytics/SalaryStatsTable'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployeeFilterOptions } from '../hooks/useEmployeeFilterOptions'
import { useSalaryAnalytics } from '../hooks/useSalaryAnalytics'

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

  return (
    <section aria-labelledby="analytics-heading">
      <h1 id="analytics-heading">Salary Analytics</h1>

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
        <LoadingIndicator label="Loading salary analytics…" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={retry} />
      ) : hasResults && data ? (
        <>
          <section aria-labelledby="analytics-overall-heading">
            <h2 id="analytics-overall-heading">Overall</h2>
            <div className="salary-stat-cards">
              {data.overall.map((stats) => (
                <SalaryStatCard key={stats.currency} stats={stats} />
              ))}
            </div>
          </section>

          <section aria-labelledby="analytics-department-heading">
            <h2 id="analytics-department-heading">By department</h2>
            <SalaryStatsTable
              rows={data.by_department}
              groupLabel="Department"
              getGroupValue={(row) => row.department}
              caption="Salary statistics by department"
            />
          </section>

          <section aria-labelledby="analytics-country-heading">
            <h2 id="analytics-country-heading">By country</h2>
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
