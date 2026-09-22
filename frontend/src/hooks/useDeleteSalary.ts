import { useCallback, useState } from 'react'
import { deleteEmployeeSalary } from '../api/employees'
import { ApiError } from '../api/client'

export interface UseDeleteSalaryResult {
  /** True while the delete request is in flight — disable the confirm/cancel controls on this, not just track it manually. */
  isDeleting: boolean
  /**
   * A failure from the last delete attempt: the employee no longer exists
   * (`404`), the salary was already removed (`404`), an unauthorized or
   * forbidden response, a network failure, or an unexpected error.
   */
  error: string | null
  /** Deletes the salary for `employeeId`; resolves `true` on success, `false` on failure (inspect `error` for why). */
  submit: (employeeId: number) => Promise<boolean>
  /** Clears a stale `error` from a previous attempt — call when the confirmation dialog is dismissed. */
  reset: () => void
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong while deleting the salary. Please try again.'
const SALARY_NOT_FOUND_MESSAGE =
  'This employee no longer has a salary record to delete. It may have already been removed.'
const EMPLOYEE_NOT_FOUND_MESSAGE = 'This employee could not be found. They may have been removed.'

/**
 * Encapsulates submission state for the salary deletion confirmation dialog
 * (`pages/EmployeeDetailsPage.tsx`), mirroring `hooks/useUpdateSalary.ts`'s
 * pattern for a one-shot mutation. A `401` is already handled centrally by
 * the shared client (`../api/client.ts`), which clears the session and
 * flips the app to the unauthenticated state — this hook doesn't
 * special-case it, same as every other data hook here; nor does it
 * special-case a `403`, since nothing in this backend issues one today (see
 * `app.api.v1.dependencies.require_auth`) — either still surfaces
 * through the generic branch below via the normalized `ApiError` message.
 *
 * Distinguishes the failure shapes from the backend
 * (`api/employees.ts`'s `deleteEmployeeSalary` doc comment):
 * - `SALARY_NOT_FOUND` (`404`): the salary was already deleted (e.g. in
 *   another tab) before this request landed.
 * - `EMPLOYEE_NOT_FOUND` (`404`): the employee itself was removed in the
 *   same window.
 * - anything else (network failure, `401`, unexpected `500`, etc.): the
 *   normalized `ApiError` message, or a generic fallback if there is none.
 */
export function useDeleteSalary(): UseDeleteSalaryResult {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (employeeId: number): Promise<boolean> => {
    setIsDeleting(true)
    setError(null)

    try {
      await deleteEmployeeSalary(employeeId)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SALARY_NOT_FOUND') {
        setError(SALARY_NOT_FOUND_MESSAGE)
      } else if (err instanceof ApiError && err.code === 'EMPLOYEE_NOT_FOUND') {
        setError(EMPLOYEE_NOT_FOUND_MESSAGE)
      } else {
        setError(err instanceof ApiError ? err.message : GENERIC_ERROR_MESSAGE)
      }
      return false
    } finally {
      setIsDeleting(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
  }, [])

  return { isDeleting, error, submit, reset }
}
