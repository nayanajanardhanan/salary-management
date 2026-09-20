import type { FormEvent } from 'react'

interface SalaryRangeFilterProps {
  currencies: string[]
  isLoadingCurrencies: boolean
  currency: string
  minSalary: string
  maxSalary: string
  validationError: string | null
  hasActiveFilter: boolean
  onCurrencyChange: (value: string) => void
  onMinSalaryChange: (value: string) => void
  onMaxSalaryChange: (value: string) => void
  onSubmit: () => void
  onClear: () => void
}

const ERROR_ID = 'salary-range-filter-error'

/**
 * Salary-range filter controls for the employee listing
 * (`docs/requirements.md` FR-4.3): currency + optional min/max, applied via
 * an explicit submit (like `EmployeeSearch`, not on every keystroke — a
 * numeric field firing a request per keystroke would be wasteful and
 * validation needs the full combination at once, not one field at a time).
 * Owns no fetch or validation logic itself (`docs/architecture.md` Section
 * 5.2) — `EmployeeListPage` validates and decides what's actually applied.
 *
 * `minSalary`/`maxSalary` are plain text inputs (`inputMode="decimal"` for
 * a numeric keyboard on mobile), not `type="number"`: a native number input
 * silently discards non-numeric keystrokes instead of letting them reach
 * our own validation, which would make "must be numeric" errors
 * unreachable and inconsistent across browsers/test environments. Custom
 * validation (`EmployeeListPage`) reports one combined, accessible error
 * message instead.
 */
export function SalaryRangeFilter({
  currencies,
  isLoadingCurrencies,
  currency,
  minSalary,
  maxSalary,
  validationError,
  hasActiveFilter,
  onCurrencyChange,
  onMinSalaryChange,
  onMaxSalaryChange,
  onSubmit,
  onClear,
}: SalaryRangeFilterProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="salary-range-filter" aria-label="Filter by salary range" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="salary-currency-filter">Currency</label>
        <select
          id="salary-currency-filter"
          value={currency}
          disabled={isLoadingCurrencies}
          aria-describedby={validationError ? ERROR_ID : undefined}
          onChange={(event) => onCurrencyChange(event.target.value)}
        >
          <option value="">Select currency</option>
          {currencies.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="salary-min-filter">Minimum salary</label>
        <input
          id="salary-min-filter"
          type="text"
          inputMode="decimal"
          placeholder="No minimum"
          value={minSalary}
          aria-describedby={validationError ? ERROR_ID : undefined}
          aria-invalid={validationError ? true : undefined}
          onChange={(event) => onMinSalaryChange(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="salary-max-filter">Maximum salary</label>
        <input
          id="salary-max-filter"
          type="text"
          inputMode="decimal"
          placeholder="No maximum"
          value={maxSalary}
          aria-describedby={validationError ? ERROR_ID : undefined}
          aria-invalid={validationError ? true : undefined}
          onChange={(event) => onMaxSalaryChange(event.target.value)}
        />
      </div>

      <button type="submit">Apply salary filter</button>
      {hasActiveFilter ? (
        <button type="button" onClick={onClear}>
          Clear salary filter
        </button>
      ) : null}

      <p className="salary-range-filter__scope">
        {currency
          ? `Filtering salary amounts in ${currency} only — other currencies are excluded, never converted or combined.`
          : 'Select a currency to filter by salary amount; salaries are never combined across currencies.'}
      </p>

      {validationError ? (
        <p className="salary-range-filter__error" role="alert" id={ERROR_ID}>
          {validationError}
        </p>
      ) : null}
    </form>
  )
}
