import { useState } from 'react'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { EmployeeSearch } from '../components/employee/EmployeeSearch'
import { EmployeeTable } from '../components/employee/EmployeeTable'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployeeList } from '../hooks/useEmployeeList'

/**
 * Employee listing page (`docs/requirements.md` FR-1.3, Acceptance
 * Criterion 8.1), with search by name or employee ID (FR-3.1-FR-3.3).
 * Filtering, sorting, and interactive pagination are intentionally out of
 * scope for this page in this commit; it shows one page of employees using
 * the backend's default pagination.
 */
export function EmployeeListPage() {
  useDocumentTitle('Employees - PayScope')

  // `searchInput` is the live text in the field; `appliedSearch` is what was
  // last submitted and actually sent to the backend (FR-3.1). Keeping them
  // separate means typing never triggers a request — only submitting
  // (Search/Clear) does.
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const { data, isLoading, error, retry } = useEmployeeList(appliedSearch)

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

  return (
    <section aria-labelledby="employee-list-heading">
      <h1 id="employee-list-heading">Employees</h1>

      <EmployeeSearch
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={handleSearchSubmit}
        onClear={handleSearchClear}
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
          message={appliedSearch ? `No employees match "${appliedSearch}".` : 'No employees found.'}
        />
      )}
    </section>
  )
}
