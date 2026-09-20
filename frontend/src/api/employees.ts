import { apiRequest } from './client'
import type { EmployeeListResponse } from '../types/employee'

const EMPLOYEES_ENDPOINT = '/api/v1/employees'

/**
 * Fetches one page of employees via the shared authenticated client
 * (`./client.ts`), which attaches the `Authorization` header and normalizes
 * errors — this module never calls `fetch` directly.
 *
 * Called with no query parameters, so the backend's own defaults apply
 * (`page=1`, `page_size=20`; see `app.utils.pagination`), rather than this
 * module re-declaring them and risking drift from the backend's actual
 * limits.
 */
export function fetchEmployees(): Promise<EmployeeListResponse> {
  return apiRequest<EmployeeListResponse>(EMPLOYEES_ENDPOINT)
}
