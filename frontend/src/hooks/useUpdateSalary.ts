import { useCallback, useState } from 'react'
import { updateEmployeeSalary } from '../api/employees'
import { ApiError } from '../api/client'
import type { Salary, SalaryUpdate } from '../types/employee'

type SalaryFieldErrors = Partial<Record<keyof SalaryUpdate, string>>

interface ValidationErrorDetail {
  location: unknown[]
  message: string
  type: string
}

export interface UseUpdateSalaryResult {
  /** True while the update request is in flight — disable the submit button on this, not just track it manually. */
  isSubmitting: boolean
  /**
   * A failure that isn't tied to one field: the employee no longer exists
   * (`404`), the employee has no salary record left to update (`404`), a
   * network failure, an unauthorized response, an unexpected `500`, or a
   * `422` that didn't map to a known field.
   */
  formError: string | null
  /** Per-field messages from the backend — field-level `422` validation details on `amount`/`currency`. */
  fieldErrors: SalaryFieldErrors
  /** Submits `data` for `employeeId`; returns the updated salary on success, or `null` on failure (inspect `formError`/`fieldErrors` for why). */
  submit: (employeeId: number, data: SalaryUpdate) => Promise<Salary | null>
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong while updating the salary. Please try again.'
const SALARY_NOT_FOUND_MESSAGE =
  'This employee no longer has a salary record to update. It may have been removed.'
const EMPLOYEE_NOT_FOUND_MESSAGE = 'This employee could not be found. They may have been removed.'

const SALARY_UPDATE_FIELDS: ReadonlySet<string> = new Set<keyof SalaryUpdate>(['amount', 'currency'])

/**
 * Encapsulates submission state for the salary editing form
 * (`pages/EmployeeSalaryEditPage.tsx`), mirroring `hooks/useCreateSalary.ts`'s
 * pattern for a one-shot mutation. A `401` is already handled centrally by
 * the shared client (`../api/client.ts`), which clears the session and
 * flips the app to the unauthenticated state — this hook doesn't
 * special-case it, same as every other data hook here.
 *
 * Distinguishes the failure shapes from the backend
 * (`api/employees.ts`'s `updateEmployeeSalary` doc comment):
 * - `SALARY_NOT_FOUND` (`404`): the employee's salary record was removed
 *   between the page loading and this submission (this endpoint only
 *   updates an existing record, it never creates one) — form-level, since
 *   no single field caused it.
 * - `EMPLOYEE_NOT_FOUND` (`404`): the employee itself was removed in the
 *   same window — also form-level.
 * - `VALIDATION_ERROR` (`422`, from `RequestValidationError`): each
 *   `details` entry's `location` ends with the offending field name (e.g.
 *   `["body", "amount"]`); mapped to that field when recognized, otherwise
 *   folded into `formError` so nothing is silently dropped.
 * - anything else (network failure, `401`, unexpected `500`, etc.): a
 *   single `formError`, using the normalized `ApiError` message when
 *   there is one.
 */
export function useUpdateSalary(): UseUpdateSalaryResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<SalaryFieldErrors>({})

  const submit = useCallback(async (employeeId: number, data: SalaryUpdate): Promise<Salary | null> => {
    setIsSubmitting(true)
    setFormError(null)
    setFieldErrors({})

    try {
      const salary = await updateEmployeeSalary(employeeId, data)
      return salary
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SALARY_NOT_FOUND') {
        setFormError(SALARY_NOT_FOUND_MESSAGE)
      } else if (err instanceof ApiError && err.code === 'EMPLOYEE_NOT_FOUND') {
        setFormError(EMPLOYEE_NOT_FOUND_MESSAGE)
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
        const nextFieldErrors: SalaryFieldErrors = {}
        for (const detail of err.details as ValidationErrorDetail[]) {
          const field = detail.location[detail.location.length - 1]
          if (typeof field === 'string' && SALARY_UPDATE_FIELDS.has(field)) {
            nextFieldErrors[field as keyof SalaryUpdate] = detail.message
          }
        }
        if (Object.keys(nextFieldErrors).length > 0) {
          setFieldErrors(nextFieldErrors)
        } else {
          setFormError(err.message)
        }
      } else {
        setFormError(err instanceof ApiError ? err.message : GENERIC_ERROR_MESSAGE)
      }
      return null
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return { isSubmitting, formError, fieldErrors, submit }
}
