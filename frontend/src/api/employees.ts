import { apiRequest } from './client'
import type { EmployeeListResponse, SortOrder } from '../types/employee'

const EMPLOYEES_ENDPOINT = '/api/v1/employees'

export interface FetchEmployeesParams {
  /**
   * Matched against employee code, first name, or last name
   * (`app.api.v1.dependencies.employee_filters_params`'s `search`, FR-3.1).
   * Case-insensitivity and partial matching (FR-3.2) are backend behavior;
   * this module just forwards the value.
   */
  search?: string
  /** Exact-match filter on department (FR-4.1); combines with `search`/`country` via AND. */
  department?: string
  /** Exact-match filter on country (FR-4.2); combines with `search`/`department` via AND. */
  country?: string
  /**
   * Exact-match filter on the employee's salary currency (FR-4.3/FR-7.3).
   * Pair with `minSalary`/`maxSalary` to scope a salary range to one
   * currency (`docs/requirements.md` Section 5: amounts in different
   * currencies are never combined) — enforcing that pairing is the
   * caller's responsibility (`hooks/useEmployeeList.ts`'s caller), not this
   * module's.
   */
  currency?: string
  /**
   * Minimum salary amount, inclusive (FR-4.3). A decimal string, not a
   * `number` — matches how `types/employee.ts` types `Salary.amount`, to
   * avoid float precision loss; already-validated numeric text by the time
   * it reaches this module.
   */
  minSalary?: string
  /** Maximum salary amount, inclusive (FR-4.3). Same decimal-string rationale as `minSalary`. */
  maxSalary?: string
  /**
   * Sort field, checked by the backend against its `SORTABLE_FIELDS`
   * allowlist (`app.services.employee_service`; mirrored in
   * `types/employee.ts`'s `EMPLOYEE_SORT_FIELDS`). Omit (or pass the
   * backend default, `"id"`) for the default listing order.
   */
  sortBy?: string
  /** Sort direction; omit (or pass the backend default, `"asc"`) for the default listing order. */
  sortOrder?: SortOrder
}

/**
 * Fetches one page of employees via the shared authenticated client
 * (`./client.ts`), which attaches the `Authorization` header and normalizes
 * errors — this module never calls `fetch` directly.
 *
 * Each optional param is forwarded only when non-empty, so a caller can
 * combine any subset of `search`/`department`/`country` (FR-4.4) without
 * this module needing to know which combination is active. Pagination
 * (`page`/`page_size`) is left unset so the backend's own defaults apply
 * (`page=1`, `page_size=20`; see `app.utils.pagination`), rather than this
 * module re-declaring them and risking drift from the backend's actual
 * limits.
 */
export function fetchEmployees(params: FetchEmployeesParams = {}): Promise<EmployeeListResponse> {
  const query = new URLSearchParams()
  if (params.search) {
    query.set('search', params.search)
  }
  if (params.department) {
    query.set('department', params.department)
  }
  if (params.country) {
    query.set('country', params.country)
  }
  if (params.currency) {
    query.set('currency', params.currency)
  }
  if (params.minSalary) {
    query.set('min_salary', params.minSalary)
  }
  if (params.maxSalary) {
    query.set('max_salary', params.maxSalary)
  }
  if (params.sortBy) {
    query.set('sort_by', params.sortBy)
  }
  if (params.sortOrder) {
    query.set('sort_order', params.sortOrder)
  }

  const queryString = query.toString()
  return apiRequest<EmployeeListResponse>(
    queryString ? `${EMPLOYEES_ENDPOINT}?${queryString}` : EMPLOYEES_ENDPOINT,
  )
}
