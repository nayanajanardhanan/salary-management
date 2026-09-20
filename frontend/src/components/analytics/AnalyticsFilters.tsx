interface AnalyticsFiltersProps {
  departments: string[]
  countries: string[]
  currencies: string[]
  isLoadingOptions: boolean
  optionsError: string | null
  department: string
  country: string
  currency: string
  onDepartmentChange: (value: string) => void
  onCountryChange: (value: string) => void
  onCurrencyChange: (value: string) => void
  onClearAll: () => void
}

/**
 * Department/country/currency filter controls for the salary analytics
 * dashboard — only filters the backend's `/analytics/salary` endpoint
 * actually supports (`app.api.v1.dependencies.salary_filters_params`).
 * Mirrors `components/employee/EmployeeFilters.tsx`'s controlled,
 * apply-on-change pattern (a select change is already one discrete action,
 * so no submit step is needed) and adds a currency select, reusing the same
 * option-sourcing hook (`hooks/useEmployeeFilterOptions.ts`) the employee
 * listing's filters already use.
 *
 * Unlike the employee listing's salary-range filter, currency here is never
 * *required*: every statistic is already labeled with its own currency
 * (`SalaryStatCard`/`SalaryStatsTable`), so selecting "All currencies" is a
 * valid, meaningful state — it just shows every currency's figures
 * separately rather than narrowing to one.
 */
export function AnalyticsFilters({
  departments,
  countries,
  currencies,
  isLoadingOptions,
  optionsError,
  department,
  country,
  currency,
  onDepartmentChange,
  onCountryChange,
  onCurrencyChange,
  onClearAll,
}: AnalyticsFiltersProps) {
  const hasActiveFilter = department !== '' || country !== '' || currency !== ''

  return (
    <div className="analytics-filters" role="group" aria-label="Filter salary analytics">
      <div className="field">
        <label htmlFor="analytics-department-filter">Department</label>
        <select
          id="analytics-department-filter"
          value={department}
          disabled={isLoadingOptions}
          onChange={(event) => onDepartmentChange(event.target.value)}
        >
          <option value="">All departments</option>
          {departments.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="analytics-country-filter">Country</label>
        <select
          id="analytics-country-filter"
          value={country}
          disabled={isLoadingOptions}
          onChange={(event) => onCountryChange(event.target.value)}
        >
          <option value="">All countries</option>
          {countries.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="analytics-currency-filter">Currency</label>
        <select
          id="analytics-currency-filter"
          value={currency}
          disabled={isLoadingOptions}
          onChange={(event) => onCurrencyChange(event.target.value)}
        >
          <option value="">All currencies</option>
          {currencies.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilter ? (
        <button type="button" onClick={onClearAll}>
          Clear filters
        </button>
      ) : null}

      {optionsError ? (
        <p className="analytics-filters__notice" role="status">
          {optionsError}
        </p>
      ) : null}
    </div>
  )
}
