interface EmployeeFiltersProps {
  departments: string[]
  countries: string[]
  isLoadingOptions: boolean
  optionsError: string | null
  department: string
  country: string
  onDepartmentChange: (value: string) => void
  onCountryChange: (value: string) => void
  onClearAll: () => void
}

/**
 * Department/country filter controls for the employee listing
 * (`docs/requirements.md` FR-4.1/FR-4.2): renders selects and a "Clear
 * filters" action from props, owns no fetch logic itself
 * (`docs/architecture.md` Section 5.2) — `EmployeeListPage` decides when a
 * filter is actually applied and where the option lists come from
 * (`hooks/useEmployeeFilterOptions.ts`).
 *
 * Each select's first option ("All departments"/"All countries", value
 * `""`) is the accessible way to remove that one filter — a native,
 * keyboard-operable control rather than a separate icon-only button per
 * filter. Selecting a value applies it immediately: unlike free-text search,
 * a select change is already one discrete, deliberate action, so there's no
 * risk of firing a request per keystroke and no need for a submit step.
 */
export function EmployeeFilters({
  departments,
  countries,
  isLoadingOptions,
  optionsError,
  department,
  country,
  onDepartmentChange,
  onCountryChange,
  onClearAll,
}: EmployeeFiltersProps) {
  const hasActiveFilter = department !== '' || country !== ''

  return (
    <div className="employee-filters" role="group" aria-label="Filter employees">
      <div className="field">
        <label htmlFor="employee-department-filter">Department</label>
        <select
          id="employee-department-filter"
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
        <label htmlFor="employee-country-filter">Country</label>
        <select
          id="employee-country-filter"
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

      {hasActiveFilter ? (
        <button type="button" className="btn btn-sm" onClick={onClearAll}>
          Clear filters
        </button>
      ) : null}

      {optionsError ? (
        <p className="employee-filters__notice" role="status">
          {optionsError}
        </p>
      ) : null}
    </div>
  )
}
