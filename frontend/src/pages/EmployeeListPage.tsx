import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingRegion, SkeletonTable } from '../components/common/LoadingIndicator'
import { PlusIcon } from '../components/common/icons'
import { EmployeeFilters } from '../components/employee/EmployeeFilters'
import { EmployeePagination } from '../components/employee/EmployeePagination'
import { EmployeeSearch } from '../components/employee/EmployeeSearch'
import { EmployeeSort } from '../components/employee/EmployeeSort'
import { EmployeeTable } from '../components/employee/EmployeeTable'
import { SalaryRangeFilter } from '../components/employee/SalaryRangeFilter'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployeeFilterOptions } from '../hooks/useEmployeeFilterOptions'
import { useEmployeeList } from '../hooks/useEmployeeList'
import {
  DEFAULT_EMPLOYEE_PAGE,
  DEFAULT_EMPLOYEE_PAGE_SIZE,
  DEFAULT_EMPLOYEE_SORT_BY,
  DEFAULT_EMPLOYEE_SORT_ORDER,
} from '../types/employee'
import type { SortOrder } from '../types/employee'

/**
 * Employee listing page (`docs/requirements.md` FR-1.3, Acceptance
 * Criterion 8.1), with search by name or employee ID (FR-3.1-FR-3.3),
 * department/country filters (FR-4.1/FR-4.2/FR-4.4), a salary-range filter
 * scoped to one currency (FR-4.3), sorting by any backend-supported field,
 * and interactive server-side pagination (FR-5.1-FR-5.4).
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

  // Sort field/direction apply immediately on selection, like
  // department/country. State always holds a real value (defaulting to the
  // backend's own default, `id`/`asc`) so the controls always show a
  // meaningful selection; the request itself omits `sort_by`/`sort_order`
  // when they match that default, keeping an unsorted-listing request
  // identical to before sorting existed.
  const [sortBy, setSortBy] = useState(DEFAULT_EMPLOYEE_SORT_BY)
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_EMPLOYEE_SORT_ORDER)
  const isDefaultSort = sortBy === DEFAULT_EMPLOYEE_SORT_BY && sortOrder === DEFAULT_EMPLOYEE_SORT_ORDER

  // Pagination: unlike search/filters/sort, `page`/`pageSize` are always
  // sent explicitly (never omitted at their default), since pagination is
  // a required, always-present dimension of the list request, not an
  // optional refinement — every request states exactly which page it's
  // asking for.
  const [page, setPage] = useState(DEFAULT_EMPLOYEE_PAGE)
  const [pageSize, setPageSize] = useState(DEFAULT_EMPLOYEE_PAGE_SIZE)

  const { data, isLoading, error, retry } = useEmployeeList(appliedSearch, {
    department,
    country,
    currency: appliedCurrency,
    minSalary: appliedMinSalary,
    maxSalary: appliedMaxSalary,
    sortBy: isDefaultSort ? '' : sortBy,
    sortOrder: isDefaultSort ? '' : sortOrder,
    page,
    pageSize,
  })
  const {
    departments,
    countries,
    currencies,
    isLoading: isLoadingFilterOptions,
    error: filterOptionsError,
  } = useEmployeeFilterOptions()

  function handleSearchSubmit() {
    const trimmed = searchInput.trim()
    setSearchInput(trimmed)
    setAppliedSearch(trimmed)
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handleSearchClear() {
    setSearchInput('')
    setAppliedSearch('')
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handleDepartmentChange(value: string) {
    setDepartment(value)
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handleCountryChange(value: string) {
    setCountry(value)
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handleClearFilters() {
    setDepartment('')
    setCountry('')
    setPage(DEFAULT_EMPLOYEE_PAGE)
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
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handleSalaryClear() {
    setCurrencyInput('')
    setMinSalaryInput('')
    setMaxSalaryInput('')
    setSalaryValidationError(null)
    setAppliedCurrency('')
    setAppliedMinSalary('')
    setAppliedMaxSalary('')
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handleSortByChange(value: string) {
    setSortBy(value)
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handleSortOrderChange(value: SortOrder) {
    setSortOrder(value)
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handleSortReset() {
    setSortBy(DEFAULT_EMPLOYEE_SORT_BY)
    setSortOrder(DEFAULT_EMPLOYEE_SORT_ORDER)
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value)
    setPage(DEFAULT_EMPLOYEE_PAGE)
  }

  function handlePreviousPage() {
    if (data && data.page > 1) {
      setPage(data.page - 1)
    }
  }

  function handleNextPage() {
    if (data && data.has_next) {
      setPage(data.page + 1)
    }
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
      <div className="page-header">
        <div className="page-header__text">
          <span className="page-header__eyebrow">Employees</span>
          <h1 id="employee-list-heading">Employees</h1>
          <p className="page-header__description">
            Search, filter, sort, and manage every employee and their current salary record.
          </p>
        </div>
        <div className="page-header__actions">
          <Link to="/employees/new" className="btn btn-primary">
            <PlusIcon width={16} height={16} />
            Add employee
          </Link>
        </div>
      </div>

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
        onDepartmentChange={handleDepartmentChange}
        onCountryChange={handleCountryChange}
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

      <EmployeeSort
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortByChange={handleSortByChange}
        onSortOrderChange={handleSortOrderChange}
        onReset={handleSortReset}
      />

      {isLoading ? (
        <LoadingRegion label="Loading employees…">
          <SkeletonTable rows={8} columns={4} />
        </LoadingRegion>
      ) : error ? (
        <ErrorMessage message={error} onRetry={retry} />
      ) : data && data.items.length > 0 ? (
        <div className="table-card">
          <EmployeeTable employees={data.items} />
        </div>
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

      <EmployeePagination
        page={page}
        pageSize={pageSize}
        data={data}
        onPageSizeChange={handlePageSizeChange}
        onPrevious={handlePreviousPage}
        onNext={handleNextPage}
      />
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
