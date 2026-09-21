import { useCallback, useEffect, useState } from 'react'
import { fetchEmployee } from '../api/employees'
import { ApiError } from '../api/client'
import type { EmployeeRead } from '../types/employee'

interface UseEmployeeResult {
  employee: EmployeeRead | null
  isLoading: boolean
  /** Set for any failure other than "not found" — see below. */
  error: string | null
  /** No employee exists with this id (or the id itself is invalid). */
  notFound: boolean
  /** Re-runs the request (e.g. from the error state's "Try again" action). */
  retry: () => void
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong while loading the employee. Please try again.'

/**
 * Loads a single employee's core fields via `GET /employees/{id}`, with no
 * requirement that they already have a salary record — unlike
 * `useEmployeeDetails`, which 404s entirely when there's no salary yet.
 * Used by the salary creation page (`pages/EmployeeSalaryCreatePage.tsx`),
 * which is reached precisely for an employee that has no salary.
 *
 * `employeeId` that isn't a positive integer (e.g. a non-numeric route
 * param) is treated as `notFound` immediately, without sending a request —
 * mirroring `useEmployeeDetails`'s same guard.
 */
export function useEmployee(employeeId: number): UseEmployeeResult {
  const [employee, setEmployee] = useState<EmployeeRead | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setNotFound(false)
    setEmployee(null)

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      setIsLoading(false)
      setNotFound(true)
      return
    }

    fetchEmployee(employeeId)
      .then((response) => {
        if (!cancelled) {
          setEmployee(response)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'EMPLOYEE_NOT_FOUND') {
          setNotFound(true)
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

  return { employee, isLoading, error, notFound, retry }
}
