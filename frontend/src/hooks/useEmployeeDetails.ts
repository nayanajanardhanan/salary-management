import { useCallback, useEffect, useState } from 'react'
import { fetchEmployeeDetails } from '../api/employees'
import { ApiError } from '../api/client'
import type { EmployeeSalaryDetails } from '../types/employee'

interface UseEmployeeDetailsResult {
  data: EmployeeSalaryDetails | null
  isLoading: boolean
  /** Set for any failure other than "not found" / "no salary record" — see those below. */
  error: string | null
  /** No employee exists with this id (or the id itself is invalid). */
  notFound: boolean
  /** The employee exists but has no salary record yet. */
  salaryUnavailable: boolean
  /** Re-runs the request (e.g. from the error state's "Try again" action). */
  retry: () => void
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong while loading employee details. Please try again.'

/**
 * Encapsulates loading/error/data state for one employee's combined
 * details+salary request, so `EmployeeDetailsPage` renders each state
 * without owning fetch logic itself (`docs/architecture.md` Section 5.4),
 * mirroring `useEmployeeList`'s pattern. A `401` is already handled
 * centrally by the shared client (`../api/client.ts`), which clears the
 * session and flips the app to the unauthenticated state — this hook
 * doesn't special-case it, same as every other data hook here.
 *
 * The backend's `/details` endpoint 404s the *entire* request both when
 * the employee doesn't exist (`EMPLOYEE_NOT_FOUND`) and when the employee
 * exists but has no salary record yet (`SALARY_NOT_FOUND`) — it never
 * returns partial employee-only data in the latter case
 * (`api/employees.ts`'s `fetchEmployeeDetails` doc comment). `notFound` and
 * `salaryUnavailable` distinguish those two cases via the normalized
 * `ApiError.code`, so the page can show an accurate message for each
 * instead of a single generic "not found".
 *
 * `employeeId` that isn't a positive integer (e.g. a non-numeric route
 * param) is treated as `notFound` immediately, without sending a request —
 * the backend's own `employee_id: int` path parameter would reject it with
 * a `422` anyway, and there's no employee to show either way.
 */
export function useEmployeeDetails(employeeId: number): UseEmployeeDetailsResult {
  const [data, setData] = useState<EmployeeSalaryDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [salaryUnavailable, setSalaryUnavailable] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setNotFound(false)
    setSalaryUnavailable(false)
    setData(null)

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      setIsLoading(false)
      setNotFound(true)
      return
    }

    fetchEmployeeDetails(employeeId)
      .then((response) => {
        if (!cancelled) {
          setData(response)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'EMPLOYEE_NOT_FOUND') {
          setNotFound(true)
        } else if (err instanceof ApiError && err.code === 'SALARY_NOT_FOUND') {
          setSalaryUnavailable(true)
        } else {
          setError(err instanceof ApiError ? err.message : GENERIC_ERROR_MESSAGE)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [employeeId, attempt])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  return { data, isLoading, error, notFound, salaryUnavailable, retry }
}
