import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { EmployeeTable } from '../components/employee/EmployeeTable'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployeeList } from '../hooks/useEmployeeList'

/**
 * Employee listing page (`docs/requirements.md` FR-1.3, Acceptance
 * Criterion 8.1). Search, filtering, sorting, and interactive pagination are
 * intentionally out of scope for this page in this commit; it shows one
 * page of employees using the backend's default pagination.
 */
export function EmployeeListPage() {
  useDocumentTitle('Employees - PayScope')

  const { data, isLoading, error, retry } = useEmployeeList()

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 0

  return (
    <section aria-labelledby="employee-list-heading">
      <h1 id="employee-list-heading">Employees</h1>

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
        <EmptyState message="No employees found." />
      )}
    </section>
  )
}
