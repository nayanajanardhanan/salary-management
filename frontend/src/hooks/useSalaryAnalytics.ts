import { useCallback, useEffect, useState } from 'react'
import { fetchSalaryStatistics } from '../api/analytics'
import { ApiError } from '../api/client'
import type { SalaryStatistics } from '../types/analytics'

export interface SalaryAnalyticsFilters {
  /** Exact-match department filter. */
  department?: string
  /** Exact-match country filter. */
  country?: string
  /** Exact-match currency filter — optional: `overall`/`by_department`/`by_country` are already scoped per currency regardless. */
  currency?: string
}

interface UseSalaryAnalyticsResult {
  data: SalaryStatistics | null
  isLoading: boolean
  error: string | null
  /** Re-runs the request (e.g. from the error state's "Try again" action). */
  retry: () => void
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong while loading salary analytics. Please try again.'

/**
 * Encapsulates loading/error/data state for the salary analytics request, so
 * `AnalyticsPage` renders each state without owning fetch logic itself
 * (`docs/architecture.md` Section 5.4), mirroring `useEmployeeList`'s
 * pattern (same `cancelled`-flag guard against a stale response overwriting
 * newer results, same `attempt`-counter retry). A `401` is already handled
 * centrally by the shared client (`../api/client.ts`), which clears the
 * session and flips the app to the unauthenticated state — this hook
 * doesn't special-case it, same as every other data hook here.
 *
 * `department`/`country`/`currency` are all optional and combine via AND,
 * same as `app.api.v1.dependencies.salary_filters_params` — an empty
 * string omits that param, so all-empty requests the full, unfiltered
 * statistics. Unlike the employee listing's salary-range filter, `currency`
 * is never *required*: every row already carries its own `currency` field
 * (`docs/requirements.md` Section 5), so filtering by it only narrows which
 * currencies appear, it's never needed to avoid combining them — the
 * backend never combines them regardless.
 */
export function useSalaryAnalytics(filters: SalaryAnalyticsFilters = {}): UseSalaryAnalyticsResult {
  const { department = '', country = '', currency = '' } = filters

  const [data, setData] = useState<SalaryStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetchSalaryStatistics({ department, country, currency })
      .then((response) => {
        if (!cancelled) {
          setData(response)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : GENERIC_ERROR_MESSAGE)
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [department, country, currency, attempt])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  return { data, isLoading, error, retry }
}
