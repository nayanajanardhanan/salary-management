/**
 * Mirrors `app.schemas.employee`/`app.schemas.salary` (backend). `Salary.amount`
 * is serialized by the backend as a decimal *string* (e.g. `"95000.00"`), not a
 * JSON number, so it's typed as `string` here rather than `number` to avoid
 * silent precision loss — formatting happens in `utils/formatting.ts`.
 */

export type EmploymentStatus = 'active' | 'inactive' | 'terminated'

/** Mirrors `app.schemas.salary.SalaryRead`. */
export interface Salary {
  employee_id: number
  amount: string
  currency: string
}

/** Mirrors `app.schemas.employee.EmployeeListItem`. `salary` is `null` for an employee with no salary record. */
export interface EmployeeListItem {
  id: number
  employee_code: string
  first_name: string
  last_name: string
  department: string
  country: string
  job_title: string
  employment_status: EmploymentStatus
  salary: Salary | null
}

/** Mirrors `app.schemas.employee.EmployeeListResponse`: a page of employees plus pagination metadata. */
export interface EmployeeListResponse {
  items: EmployeeListItem[]
  page: number
  page_size: number
  total: number
  has_next: boolean
}

/** Mirrors `app.utils.sorting.SortOrder`. */
export type SortOrder = 'asc' | 'desc'

/**
 * Mirrors `app.services.employee_service.SORTABLE_FIELDS`'s keys, each with
 * a human-readable label. There is no endpoint that exposes this allowlist
 * at runtime (unlike department/country/currency, which are sourced from
 * `hooks/useEmployeeFilterOptions.ts`) — it's a fixed part of the API
 * contract, not data, so it's mirrored here the same way `EmploymentStatus`
 * above mirrors a backend enum. Keep in sync with the backend allowlist by
 * hand; sending a `sort_by` outside it is rejected by the backend with a
 * `422` (`app.api.v1.dependencies.employee_sort_params`).
 */
export const EMPLOYEE_SORT_FIELDS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'id', label: 'Employee record ID' },
  { value: 'employee_code', label: 'Employee code' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'department', label: 'Department' },
  { value: 'country', label: 'Country' },
  { value: 'job_title', label: 'Job title' },
  { value: 'employment_status', label: 'Employment status' },
]

/** Mirrors `app.services.employee_service.DEFAULT_SORT_BY`. */
export const DEFAULT_EMPLOYEE_SORT_BY = 'id'
/** Mirrors `app.services.employee_service.DEFAULT_SORT_ORDER`. */
export const DEFAULT_EMPLOYEE_SORT_ORDER: SortOrder = 'asc'
