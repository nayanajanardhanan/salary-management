import { useEffect, useState } from 'react'
import { fetchSalaryStatistics } from '../api/analytics'
import { ApiError } from '../api/client'

interface UseEmployeeFilterOptionsResult {
  departments: string[]
  countries: string[]
  isLoading: boolean
  /** Non-fatal: filter dropdowns fall back to "All" only, the listing itself is unaffected. */
  error: string | null
}

const GENERIC_ERROR_MESSAGE = 'Unable to load filter options right now.'

/**
 * Sources the distinct department/country values for the employee list's
 * filter dropdowns (FR-4.1/FR-4.2) from the existing salary statistics
 * endpoint's `by_department`/`by_country` group names (`api/analytics.ts`),
 * since the backend has no dedicated "distinct values" endpoint and the
 * employee listing itself is paginated (never loads the full ~10,000-row
 * dataset client-side to enumerate values, `docs/architecture.md` Section
 * 1.3). Each group appears once per currency, so names are de-duplicated
 * and sorted for a stable, readable dropdown order.
 *
 * Assumes every employee has a salary record (`docs/requirements.md`
 * Section 7: "each employee has exactly one country, one department, and
 * one active salary at a time") — a department/country used only by
 * employees with no salary record would not appear as a selectable option,
 * though it would still be included correctly if selected via search
 * results. A `401` is handled centrally by the shared client, same as
 * `useEmployeeList`.
 */
export function useEmployeeFilterOptions(): UseEmployeeFilterOptionsResult {
  const [departments, setDepartments] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchSalaryStatistics()
      .then((stats) => {
        if (cancelled) return
        setDepartments(dedupeSorted(stats.by_department.map((entry) => entry.department)))
        setCountries(dedupeSorted(stats.by_country.map((entry) => entry.country)))
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
  }, [])

  return { departments, countries, isLoading, error }
}

function dedupeSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}
