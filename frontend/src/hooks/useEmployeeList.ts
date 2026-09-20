import { useCallback, useEffect, useState } from 'react'
import { fetchEmployees } from '../api/employees'
import { ApiError } from '../api/client'
import type { EmployeeListResponse } from '../types/employee'

interface UseEmployeeListResult {
  data: EmployeeListResponse | null
  isLoading: boolean
  error: string | null
  /** Re-runs the request (e.g. from the error state's "Try again" action). */
  retry: () => void
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong while loading employees. Please try again.'

/**
 * Encapsulates loading/error/data state for the employee listing request, so
 * `EmployeeListPage` renders the three states without owning fetch logic
 * itself (`docs/architecture.md` Section 5.4). A `401` is already handled by
 * the shared client (`../api/client.ts`), which clears the session and flips
 * the app to the unauthenticated state — this hook doesn't special-case it.
 *
 * `search` (FR-3.1), `department` (FR-4.1), and `country` (FR-4.2) are all
 * optional; each is already-normalized (trimmed search text, an exact
 * department/country value or `""`). Passing a new value for any of them
 * re-runs the request with all three combined (FR-4.4/FR-4.5) — an empty
 * string omits that param, so all-empty requests the unfiltered listing
 * (the same request this hook made before search/filters existed).
 */
export function useEmployeeList(search = '', department = '', country = ''): UseEmployeeListResult {
  const [data, setData] = useState<EmployeeListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetchEmployees({ search, department, country })
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
  }, [search, department, country, attempt])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  return { data, isLoading, error, retry }
}
