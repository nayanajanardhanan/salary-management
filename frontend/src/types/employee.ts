/**
 * Mirrors `app.schemas.employee`/`app.schemas.salary` (backend). `Salary.amount`
 * is serialized by the backend as a decimal *string* (e.g. `"95000.00"`), not a
 * JSON number, so it's typed as `string` here rather than `number` to avoid
 * silent precision loss — formatting happens in `utils/formatting.ts`.
 */

export type EmploymentStatus = 'active' | 'inactive' | 'terminated'

/** Mirrors `EmploymentStatus` (backend enum), each with a human-readable label — for the employee creation form's select. */
export const EMPLOYMENT_STATUS_OPTIONS: ReadonlyArray<{ value: EmploymentStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Terminated' },
]

/** Mirrors `app.models.employee.Employee.employment_status`'s column default. */
export const DEFAULT_EMPLOYMENT_STATUS: EmploymentStatus = 'active'

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

/**
 * Mirrors `app.schemas.employee.EmployeeRead` — an employee's core fields,
 * with no `salary` (unlike `EmployeeListItem`). There is no `email` field:
 * `Employee` (`app.models.employee`) doesn't store one, so the employee
 * details page has nothing to show for it (checked against the actual
 * schema rather than assumed).
 */
export interface EmployeeRead {
  id: number
  employee_code: string
  first_name: string
  last_name: string
  department: string
  country: string
  job_title: string
  employment_status: EmploymentStatus
}

/**
 * Mirrors `app.schemas.employee.EmployeeCreate` — the request body for
 * `POST /employees`. `employment_status` is optional there (defaults to
 * `EmploymentStatus.ACTIVE`), but the creation form always sends an
 * explicit value (`DEFAULT_EMPLOYMENT_STATUS`), so it's typed as required
 * here — equivalent to omitting it, since the backend's own default is the
 * same value.
 */
export interface EmployeeCreate {
  employee_code: string
  first_name: string
  last_name: string
  department: string
  country: string
  job_title: string
  employment_status: EmploymentStatus
}

/**
 * Mirrors `app.schemas.employee.EmployeeSalaryDetails`, returned by
 * `GET /employees/{id}/details` — an employee's core details together with
 * their current salary in one response (`hooks/useEmployeeDetails.ts`).
 * Unlike `EmployeeListItem.salary`, `salary` here is never `null`: the
 * backend 404s the whole request instead when the employee has no salary
 * record (see that hook's doc comment).
 */
export interface EmployeeSalaryDetails {
  employee: EmployeeRead
  salary: Salary
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

/** Mirrors `app.utils.pagination.DEFAULT_PAGE`. */
export const DEFAULT_EMPLOYEE_PAGE = 1
/** Mirrors `app.utils.pagination.DEFAULT_PAGE_SIZE`. */
export const DEFAULT_EMPLOYEE_PAGE_SIZE = 20
/**
 * Mirrors `app.utils.pagination.MAX_PAGE_SIZE`. The backend rejects
 * `page_size` above this with a `422` (`pagination_params`'s `le=MAX_PAGE_SIZE`);
 * the frontend must never request more.
 */
export const MAX_EMPLOYEE_PAGE_SIZE = 100

/**
 * Page-size choices offered by the page-size selector. Unlike
 * `EMPLOYEE_SORT_FIELDS`, this isn't a mirrored allowlist — the backend
 * accepts any integer in `[1, MAX_EMPLOYEE_PAGE_SIZE]` (`pagination_params`),
 * not a fixed enum — so this is a deliberately curated set of common,
 * backend-valid values for a usable dropdown, capped at
 * `MAX_EMPLOYEE_PAGE_SIZE` itself.
 */
export const EMPLOYEE_PAGE_SIZE_OPTIONS: ReadonlyArray<number> = [10, 20, 50, 100]
