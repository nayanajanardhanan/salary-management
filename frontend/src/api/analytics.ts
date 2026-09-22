import { apiRequest } from './client'
import type { SalaryStatistics } from '../types/analytics'

const SALARY_STATISTICS_ENDPOINT = '/api/v1/analytics/salary'

export interface FetchSalaryStatisticsParams {
  /** Exact-match filter on the associated employee's department (`app.api.v1.dependencies.salary_filters_params`). */
  department?: string
  /** Exact-match filter on the associated employee's country. */
  country?: string
  /** Exact-match filter on salary currency; scopes `overall`/`by_department`/`by_country` to just that currency. */
  currency?: string
}

/**
 * Fetches salary statistics via the shared authenticated client
 * (`./client.ts`), same as `api/employees.ts` — same base URL, auth header,
 * and error normalization, no separate request logic.
 *
 * Used two ways: with no params, by the employee listing's
 * department/country/currency filters (`hooks/useEmployeeFilterOptions.ts`)
 * to source their dropdown values from the unfiltered `by_department` /
 * `by_country` / `overall` groups; and, with `department`/`country`/`currency`,
 * by the analytics dashboard (`hooks/useSalaryAnalytics.ts`) to narrow the
 * statistics themselves. Either way the aggregation is computed server-side
 * (`app.services.analytics_service`), never by downloading every salary
 * record and aggregating client-side (`docs/architecture.md` Section 1.3).
 * `min_amount`/`max_amount`/`employee_id` (`salary_filters_params`'s other
 * filters) aren't exposed here — out of scope for both current callers.
 */
export function fetchSalaryStatistics(
  params: FetchSalaryStatisticsParams = {},
): Promise<SalaryStatistics> {
  const query = new URLSearchParams()
  if (params.department) {
    query.set('department', params.department)
  }
  if (params.country) {
    query.set('country', params.country)
  }
  if (params.currency) {
    query.set('currency', params.currency)
  }

  const queryString = query.toString()
  return apiRequest<SalaryStatistics>(
    queryString ? `${SALARY_STATISTICS_ENDPOINT}?${queryString}` : SALARY_STATISTICS_ENDPOINT,
  )
}
