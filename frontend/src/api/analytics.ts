import { apiRequest } from './client'
import type { SalaryStatistics } from '../types/analytics'

const SALARY_STATISTICS_ENDPOINT = '/api/v1/analytics/salary'

/**
 * Fetches salary statistics via the shared authenticated client
 * (`./client.ts`), same as `api/employees.ts` — same base URL, auth header,
 * and error normalization, no separate request logic.
 *
 * Used by the employee listing's department/country filters
 * (`hooks/useEmployeeFilterOptions.ts`) to source the distinct
 * department/country values for their dropdowns from `by_department` /
 * `by_country`, computed server-side (`app.services.analytics_service`) from
 * every matching salary — not paged, so it never requires looping through
 * the full employee listing client-side to enumerate values
 * (`docs/architecture.md` Section 1.3).
 */
export function fetchSalaryStatistics(): Promise<SalaryStatistics> {
  return apiRequest<SalaryStatistics>(SALARY_STATISTICS_ENDPOINT)
}
