import { useState } from 'react'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { EmployeeFilters } from '../components/employee/EmployeeFilters'
import { EmployeeSearch } from '../components/employee/EmployeeSearch'
import { EmployeeTable } from '../components/employee/EmployeeTable'
import { SalaryRangeFilter } from '../components/employee/SalaryRangeFilter'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployeeFilterOptions } from '../hooks/useEmployeeFilterOptions'
import { useEmployeeList } from '../hooks/useEmployeeList'

/**
 * Employee listing page (`docs/requirements.md` FR-1.3, Acceptance
 * Criterion 8.1), with search by name or employee ID (FR-3.1-FR-3.3),
 * department/country filters (FR-4.1/FR-4.2/FR-4.4), and a salary-range
 * filter scoped to one currency (FR-4.3). Sorting and interactive
 * pagination are intentionally out of scope for this page in this commit;
 * it shows one page of employees using the backend's default pagination.
 */
export function EmployeeListPage() {
  useDocumentTitle('Employees - PayScope')

  // `searchInput` is the live text in the field; `appliedSearch` is what was
  // last submitted and actually sent to the backend (FR-3.1). Keeping them
  // separate means typing never triggers a request — only submitting
  // (Search/Clear) does. `department`/`country` apply immediately on
  // selection, since choosing a dropdown value is already one discrete
  // action, unlike free-text keystrokes.
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [country, setCountry] = useState('')

  // Salary range: `*Input` is the live (unvalidated) form state; `applied*`
  // is what was last validated and actually sent (FR-4.3). Like search,
  // this needs an explicit submit (not apply-on-change) so the three fields
  // can be validated together before a request is ever sent.
  const [currencyInput, setCurrencyInput] = useState('')
  const [minSalaryInput, setMinSalaryInput] = useState('')
  const [maxSalaryInput, setMaxSalaryInput] = useState('')
  const [appliedCurrency, setAppliedCurrency] = useState('')
  const [appliedMinSalary, setAppliedMinSalary] = useState('')
  const [appliedMaxSalary, setAppliedMaxSalary] = useState('')
  const [salaryValidationError, setSalaryValidationError] = useState<string | null>(null)

  const { data, isLoading, error, retry } = useEmployeeList(appliedSearch, {
    department,
    country,
    currency: appliedCurrency,
    minSalary: appliedMinSalary,
    maxSalary: appliedMaxSalary,
  })
  const {
    departments,
    countries,
    currencies,
    isLoading: isLoadingFilterOptions,
    error: filterOptionsError,
  } = useEmployeeFilterOptions()

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 0

  function handleSearchSubmit() {
    const trimmed = searchInput.trim()
    setSearchInput(trimmed)
    setAppliedSearch(trimmed)
  }

  function handleSearchClear() {
    setSearchInput('')
    setAppliedSearch('')
  }

  function handleClearFilters() {
    setDepartment('')
    setCountry('')
  }

  function handleSalarySubmit() {
    const min = validateSalaryField(minSalaryInput, 'Minimum salary')
    const max = validateSalaryField(maxSalaryInput, 'Maximum salary')

    let validationMessage = min.error ?? max.error ?? null

    if (!validationMessage && min.value !== '' && max.value !== '' && Number(min.value) > Number(max.value)) {
      validationMessage = 'Minimum salary must not exceed maximum salary.'
    }

    if (!validationMessage && (min.value !== '' || max.value !== '') && currencyInput === '') {
      validationMessage = 'Select a currency before filtering by salary amount.'
    }

    if (validationMessage) {
      setSalaryValidationError(validationMessage)
      return
    }

    setMinSalaryInput(min.value)
    setMaxSalaryInput(max.value)
    setSalaryValidationError(null)
    setAppliedCurrency(currencyInput)
    setAppliedMinSalary(min.value)
    setAppliedMaxSalary(max.value)
  }

  function handleSalaryClear() {
    setCurrencyInput('')
    setMinSalaryInput('')
    setMaxSalaryInput('')
    setSalaryValidationError(null)
    setAppliedCurrency('')
    setAppliedMinSalary('')
    setAppliedMaxSalary('')
  }

  const hasSalaryFilter =
    currencyInput !== '' ||
    minSalaryInput !== '' ||
    maxSalaryInput !== '' ||
    appliedCurrency !== '' ||
    appliedMinSalary !== '' ||
    appliedMaxSalary !== ''

  return (
    <section aria-labelledby="employee-list-heading">
      <h1 id="employee-list-heading">Employees</h1>

      <EmployeeSearch
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={handleSearchSubmit}
        onClear={handleSearchClear}
      />

      <EmployeeFilters
        departments={departments}
        countries={countries}
        isLoadingOptions={isLoadingFilterOptions}
        optionsError={filterOptionsError}
        department={department}
        country={country}
        onDepartmentChange={setDepartment}
        onCountryChange={setCountry}
        onClearAll={handleClearFilters}
      />

      <SalaryRangeFilter
        currencies={currencies}
        isLoadingCurrencies={isLoadingFilterOptions}
        currency={currencyInput}
        minSalary={minSalaryInput}
        maxSalary={maxSalaryInput}
        validationError={salaryValidationError}
        hasActiveFilter={hasSalaryFilter}
        onCurrencyChange={setCurrencyInput}
        onMinSalaryChange={setMinSalaryInput}
        onMaxSalaryChange={setMaxSalaryInput}
        onSubmit={handleSalarySubmit}
        onClear={handleSalaryClear}
      />

      {isLoading ? (
        <LoadingIndicator label="Loading employees…" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={retry} />
      ) : data && data.items.length > 0 ? (
        <>
          <EmployeeTable employees={data.items} />
          <p aria-live="polite">
            Page {data.page} of {totalPages} &middot; {data.total} employee
            {data.total === 1 ? '' : 's'} total
          </p>
        </>
      ) : (
        <EmptyState
          message={describeEmptyResult(
            appliedSearch,
            department,
            country,
            appliedCurrency,
            appliedMinSalary,
            appliedMaxSalary,
          )}
        />
      )}
    </section>
  )
}

interface SalaryFieldValidation {
  value: string
  error: string | null
}

/**
 * Validates one salary text field before it's ever sent (FR-4.3): numeric
 * format first, then non-negativity — checked in that order so a
 * badly-formed value (letters, symbols) gets the more specific "must be a
 * number" message rather than being lumped in with "must not be negative",
 * mirroring the backend's own `_validate_currency_format`-style ordering
 * (`app.schemas.salary`). An empty/whitespace-only value is valid (the
 * field is optional) and normalizes to `""`. The backend's own `ge=0`
 * query-param validation (`employee_filters_params`) remains the final
 * source of truth — this only avoids sending a request that backend would
 * reject anyway.
 */
function validateSalaryField(raw: string, label: string): SalaryFieldValidation {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { value: '', error: null }
  }
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { value: trimmed, error: `${label} must be a number.` }
  }
  if (Number(trimmed) < 0) {
    return { value: trimmed, error: `${label} must not be negative.` }
  }
  return { value: trimmed, error: null }
}

/** Builds an accessible, specific "no results" message reflecting whichever filters are active. */
function describeEmptyResult(
  search: string,
  department: string,
  country: string,
  currency: string,
  minSalary: string,
  maxSalary: string,
): string {
  const criteria: string[] = []
  if (search) criteria.push(`search "${search}"`)
  if (department) criteria.push(`department "${department}"`)
  if (country) criteria.push(`country "${country}"`)

  const salaryRange = describeSalaryRange(minSalary, maxSalary, currency)
  if (salaryRange) criteria.push(salaryRange)

  return criteria.length > 0 ? `No employees match ${criteria.join(' and ')}.` : 'No employees found.'
}

function describeSalaryRange(minSalary: string, maxSalary: string, currency: string): string | null {
  if (!currency && !minSalary && !maxSalary) return null

  if (minSalary && maxSalary) return `salary between ${minSalary} and ${maxSalary} ${currency}`
  if (minSalary) return `salary at least ${minSalary} ${currency}`
  if (maxSalary) return `salary at most ${maxSalary} ${currency}`
  return `currency "${currency}"`
}
