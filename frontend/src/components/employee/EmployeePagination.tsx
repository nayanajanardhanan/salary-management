import { EMPLOYEE_PAGE_SIZE_OPTIONS } from '../../types/employee'
import type { EmployeeListResponse } from '../../types/employee'

interface EmployeePaginationProps {
  /** The page currently requested (may briefly lag `data.page` while a request is in flight). */
  page: number
  pageSize: number
  /** The last successful response, if any — the authoritative source for `has_next`/`total`/current page. */
  data: EmployeeListResponse | null
  onPageSizeChange: (value: number) => void
  onPrevious: () => void
  onNext: () => void
}

/**
 * Pagination controls for the employee listing: page-size selector +
 * Previous/Next, always rendered below the results area regardless of
 * loading/error/empty/success state, so `total`/enabled-state stay visible
 * and consistent (`data` is `null` only before the very first response
 * arrives; once loaded, a later error leaves the last successful `data` in
 * place, same as the rest of the page — `docs/architecture.md` Section
 * 5.4). Owns no fetch logic itself (`docs/architecture.md` Section 5.2);
 * `EmployeeListPage` decides what page to request next and always via the
 * backend (`useEmployeeList`), never by re-slicing an already-fetched page
 * client-side.
 *
 * Previous/Next are disabled using `data.page`/`data.has_next` (the
 * backend's own word on whether another page exists), not just local page
 * state, so a stale or not-yet-loaded response can't make either button
 * falsely enabled.
 */
export function EmployeePagination({
  page,
  pageSize,
  data,
  onPageSizeChange,
  onPrevious,
  onNext,
}: EmployeePaginationProps) {
  const total = data?.total ?? 0
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const currentPage = data?.page ?? page
  const canGoPrevious = data ? data.page > 1 : false
  const canGoNext = data ? data.has_next : false

  return (
    <nav className="employee-pagination" aria-label="Employee list pagination">
      <div className="field">
        <label htmlFor="employee-page-size">Employees per page</label>
        <select
          id="employee-page-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {EMPLOYEE_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <button type="button" onClick={onPrevious} disabled={!canGoPrevious} aria-label="Previous page">
        Previous
      </button>

      <button type="button" onClick={onNext} disabled={!canGoNext} aria-label="Next page">
        Next
      </button>

      <p className="employee-pagination__summary" aria-live="polite" aria-current="page">
        Page {currentPage} of {totalPages} &middot; {total} employee
        {total === 1 ? '' : 's'} total
      </p>
    </nav>
  )
}
