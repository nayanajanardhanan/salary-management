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
