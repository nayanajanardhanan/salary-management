import { apiRequest } from './client'
import type {
  EmployeeCreate,
  EmployeeListResponse,
  EmployeeRead,
  EmployeeSalaryDetails,
  Salary,
  SalaryCreate,
  SalaryUpdate,
  SortOrder,
} from '../types/employee'

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
  /** 1-indexed page number. Omit (or pass the backend default, `1`) for the first page. */
  page?: number
  /**
   * Records per page. Omit (or pass the backend default, `20`) for the
   * default page size. Never pass more than `MAX_EMPLOYEE_PAGE_SIZE` (100,
   * `types/employee.ts`) — the backend rejects a larger value with a `422`.
   */
  pageSize?: number
}

/**
 * Fetches one page of employees via the shared authenticated client
 * (`./client.ts`), which attaches the `Authorization` header and normalizes
 * errors — this module never calls `fetch` directly.
 *
 * Each optional param is forwarded only when given, so a caller can combine
 * any subset of `search`/`department`/`country`/etc (FR-4.4) without this
 * module needing to know which combination is active. `page`/`pageSize` are
 * likewise only sent when given — omitting them (as when no page has been
 * requested yet) lets the backend's own defaults apply (`page=1`,
 * `page_size=20`; see `app.utils.pagination`) rather than this module
 * re-declaring them and risking drift from the backend's actual limits.
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
  if (params.page !== undefined) {
    query.set('page', String(params.page))
  }
  if (params.pageSize !== undefined) {
    query.set('page_size', String(params.pageSize))
  }

  const queryString = query.toString()
  return apiRequest<EmployeeListResponse>(
    queryString ? `${EMPLOYEES_ENDPOINT}?${queryString}` : EMPLOYEES_ENDPOINT,
  )
}

/**
 * Fetches a single employee's core fields (`GET /employees/{id}`), with no
 * requirement that they already have a salary record — unlike
 * `fetchEmployeeDetails`, which 404s entirely when there's no salary. Used
 * to show the employee's identity on the salary creation form, which is
 * reached precisely when the employee has no salary yet.
 */
export function fetchEmployee(employeeId: number): Promise<EmployeeRead> {
  return apiRequest<EmployeeRead>(`${EMPLOYEES_ENDPOINT}/${employeeId}`)
}

/**
 * Fetches one employee's core details together with their current salary,
 * via the backend's combined `/details` endpoint
 * (`app.api.v1.routes.employees.get_employee_details`) rather than two
 * separate requests (`GET /employees/{id}` + `GET /employees/{id}/salary`)
 * — the backend already joins them in a single query
 * (`employee_service.get_employee_with_salary`), so a second request here
 * would be an unnecessary N+1.
 *
 * The backend 404s this endpoint both when the employee doesn't exist
 * (`error.code === 'EMPLOYEE_NOT_FOUND'`) and when the employee exists but
 * has no salary record yet (`error.code === 'SALARY_NOT_FOUND'`) — it never
 * returns partial employee-only data in the latter case. Distinguishing
 * those two is the caller's job (see `hooks/useEmployeeDetails.ts`), via
 * the normalized `ApiError.code` the shared client already extracts.
 */
export function fetchEmployeeDetails(employeeId: number): Promise<EmployeeSalaryDetails> {
  return apiRequest<EmployeeSalaryDetails>(`${EMPLOYEES_ENDPOINT}/${employeeId}/details`)
}

/**
 * Creates a new employee via the shared authenticated client, exactly like
 * every other request in this module — same base URL, auth header, and
 * error normalization, so a `409` (duplicate `employee_code`,
 * `error.code === 'EMPLOYEE_CODE_ALREADY_EXISTS'`) or a `422` (schema
 * validation, `error.code === 'VALIDATION_ERROR'`, with per-field details)
 * surfaces as the same normalized `ApiError` every other endpoint already
 * throws (`hooks/useCreateEmployee.ts` interprets it). Salary is a
 * separate resource (`POST /employees/{id}/salary`) and out of scope here.
 */
export function createEmployee(data: EmployeeCreate): Promise<EmployeeRead> {
  return apiRequest<EmployeeRead>(EMPLOYEES_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Creates the salary record for a single, existing employee via
 * `POST /employees/{id}/salary` (`app.api.v1.routes.employees.create_employee_salary`).
 * `employee_id` is taken from the path, not the request body, matching the
 * backend's `SalaryCreate` schema exactly. A `404` (no such employee,
 * `error.code === 'EMPLOYEE_NOT_FOUND'`), a `409` (the employee already has
 * a salary record — each employee has at most one,
 * `error.code === 'SALARY_ALREADY_EXISTS'`), or a `422` (schema validation,
 * `error.code === 'VALIDATION_ERROR'`, with per-field details) all surface
 * as the same normalized `ApiError` every other endpoint throws
 * (`hooks/useCreateSalary.ts` interprets it).
 */
export function createEmployeeSalary(employeeId: number, data: SalaryCreate): Promise<Salary> {
  return apiRequest<Salary>(`${EMPLOYEES_ENDPOINT}/${employeeId}/salary`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Replaces the salary record for a single, existing employee via
 * `PUT /employees/{id}/salary` (`app.api.v1.routes.employees.update_employee_salary`).
 * Full replacement (PUT semantics): `amount` and `currency` are both sent,
 * matching the backend's `SalaryUpdate` schema exactly — `employee_id` is
 * taken from the path, not the body. A `404` (no such employee,
 * `error.code === 'EMPLOYEE_NOT_FOUND'`, or the employee has no salary
 * record yet to update, `error.code === 'SALARY_NOT_FOUND'`) or a `422`
 * (schema validation, `error.code === 'VALIDATION_ERROR'`, with per-field
 * details) all surface as the same normalized `ApiError` every other
 * endpoint throws (`hooks/useUpdateSalary.ts` interprets it).
 */
export function updateEmployeeSalary(employeeId: number, data: SalaryUpdate): Promise<Salary> {
  return apiRequest<Salary>(`${EMPLOYEES_ENDPOINT}/${employeeId}/salary`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
