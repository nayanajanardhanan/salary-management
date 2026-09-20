import { apiRequest } from './client'
import type { EmployeeListResponse } from '../types/employee'

const EMPLOYEES_ENDPOINT = '/api/v1/employees'

export interface FetchEmployeesParams {
  /**
   * Matched against employee code, first name, or last name
   * (`app.api.v1.dependencies.employee_filters_params`'s `search`, FR-3.1).
   * Case-insensitivity and partial matching (FR-3.2) are backend behavior;
   * this module just forwards the value.
   */
  search?: string
}

/**
 * Fetches one page of employees via the shared authenticated client
 * (`./client.ts`), which attaches the `Authorization` header and normalizes
 * errors — this module never calls `fetch` directly.
 *
 * Only the optional `search` param is forwarded, and only when non-empty;
 * pagination (`page`/`page_size`) is left unset so the backend's own
 * defaults apply (`page=1`, `page_size=20`; see `app.utils.pagination`),
 * rather than this module re-declaring them and risking drift from the
 * backend's actual limits.
 */
export function fetchEmployees(params: FetchEmployeesParams = {}): Promise<EmployeeListResponse> {
  const query = new URLSearchParams()
  if (params.search) {
    query.set('search', params.search)
  }

  const queryString = query.toString()
  return apiRequest<EmployeeListResponse>(
    queryString ? `${EMPLOYEES_ENDPOINT}?${queryString}` : EMPLOYEES_ENDPOINT,
  )
}
