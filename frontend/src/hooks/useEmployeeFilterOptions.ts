import { useEffect, useState } from 'react'
import { fetchSalaryStatistics } from '../api/analytics'
import { ApiError } from '../api/client'

interface UseEmployeeFilterOptionsResult {
  departments: string[]
  countries: string[]
  /** Currency codes actually in use (FR-4.3/FR-7.3) — see doc comment below. */
  currencies: string[]
  isLoading: boolean
  /** Non-fatal: filter dropdowns fall back to "All"/empty only, the listing itself is unaffected. */
  error: string | null
}

const GENERIC_ERROR_MESSAGE = 'Unable to load filter options right now.'

/**
 * Sources the distinct department/country/currency values for the employee
 * list's filter controls (FR-4.1/FR-4.2/FR-4.3) from the existing salary
 * statistics endpoint's `by_department`/`by_country`/`overall` group names
 * (`api/analytics.ts`), since the backend has no dedicated "distinct
 * values" endpoint and the employee listing itself is paginated (never
 * loads the full ~10,000-row dataset client-side to enumerate values,
 * `docs/architecture.md` Section 1.3). Each group appears once per
 * currency (department/country) or once per currency-only bucket
 * (`overall`), so names are de-duplicated and sorted for a stable,
 * readable order.
 *
 * `currencies` deliberately lists only codes actually used by a stored
 * salary, not the full ISO 4217 `SUPPORTED_CURRENCY_CODES` allowlist
 * (`app.core.currencies`, ~150 codes) the backend validates salary writes
 * against — every value in `overall` was itself validated against that
 * allowlist when its salary was created, so this list is guaranteed to be
 * a subset of supported codes (never an invented one) while staying a
 * short, relevant dropdown instead of every ISO currency in the world.
 *
 * Assumes every employee has a salary record (`docs/requirements.md`
 * Section 7: "each employee has exactly one country, one department, and
 * one active salary at a time") — a department/country/currency used only
 * by employees with no salary record would not appear as a selectable
 * option, though it would still be included correctly if selected via
 * search results. A `401` is handled centrally by the shared client, same
 * as `useEmployeeList`.
 */
export function useEmployeeFilterOptions(): UseEmployeeFilterOptionsResult {
  const [departments, setDepartments] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchSalaryStatistics()
      .then((stats) => {
        if (cancelled) return
        setDepartments(dedupeSorted(stats.by_department.map((entry) => entry.department)))
        setCountries(dedupeSorted(stats.by_country.map((entry) => entry.country)))
        setCurrencies(dedupeSorted(stats.overall.map((entry) => entry.currency)))
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

  return { departments, countries, currencies, isLoading, error }
}

function dedupeSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}
