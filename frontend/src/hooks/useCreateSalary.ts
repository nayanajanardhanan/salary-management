import { useCallback, useState } from 'react'
import { createEmployeeSalary } from '../api/employees'
import { ApiError } from '../api/client'
import type { Salary, SalaryCreate } from '../types/employee'

type SalaryFieldErrors = Partial<Record<keyof SalaryCreate, string>>

interface ValidationErrorDetail {
  location: unknown[]
  message: string
  type: string
}

export interface UseCreateSalaryResult {
  /** True while the create request is in flight — disable the submit button on this, not just track it manually. */
  isSubmitting: boolean
  /**
   * A failure that isn't tied to one field: the employee already has a
   * salary (`409`), the employee no longer exists (`404`), a network
   * failure, an unauthorized response, an unexpected `500`, or a `422` that
   * didn't map to a known field.
   */
  formError: string | null
  /** Per-field messages from the backend — field-level `422` validation details on `amount`/`currency`. */
  fieldErrors: SalaryFieldErrors
  /** Submits `data` for `employeeId`; returns the created salary on success, or `null` on failure (inspect `formError`/`fieldErrors` for why). */
  submit: (employeeId: number, data: SalaryCreate) => Promise<Salary | null>
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong while adding the salary. Please try again.'
const DUPLICATE_SALARY_MESSAGE = 'This employee already has a salary record. Only one salary is allowed per employee.'
const EMPLOYEE_NOT_FOUND_MESSAGE = 'This employee could not be found. They may have been removed.'

const SALARY_CREATE_FIELDS: ReadonlySet<string> = new Set<keyof SalaryCreate>(['amount', 'currency'])

/**
 * Encapsulates submission state for the salary creation form
 * (`pages/EmployeeSalaryCreatePage.tsx`), mirroring
 * `hooks/useCreateEmployee.ts`'s pattern for a one-shot mutation. A `401` is
 * already handled centrally by the shared client (`../api/client.ts`),
 * which clears the session and flips the app to the unauthenticated
 * state — this hook doesn't special-case it, same as every other data hook
 * here.
 *
 * Distinguishes the failure shapes from the backend
 * (`api/employees.ts`'s `createEmployeeSalary` doc comment):
 * - `SALARY_ALREADY_EXISTS` (`409`): the one-active-salary-per-employee rule
 *   (`docs/requirements.md` FR-2.2) — surfaced as a form-level message
 *   rather than a field error, since no single field caused it.
 * - `EMPLOYEE_NOT_FOUND` (`404`): the employee was removed between the page
 *   loading and this submission — also form-level.
 * - `VALIDATION_ERROR` (`422`, from `RequestValidationError`): each
 *   `details` entry's `location` ends with the offending field name (e.g.
 *   `["body", "amount"]`); mapped to that field when recognized, otherwise
 *   folded into `formError` so nothing is silently dropped.
 * - anything else (network failure, `401`, unexpected `500`, etc.): a
 *   single `formError`, using the normalized `ApiError` message when
 *   there is one.
 */
export function useCreateSalary(): UseCreateSalaryResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<SalaryFieldErrors>({})

  const submit = useCallback(async (employeeId: number, data: SalaryCreate): Promise<Salary | null> => {
    setIsSubmitting(true)
    setFormError(null)
    setFieldErrors({})

    try {
      const salary = await createEmployeeSalary(employeeId, data)
      return salary
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SALARY_ALREADY_EXISTS') {
        setFormError(DUPLICATE_SALARY_MESSAGE)
      } else if (err instanceof ApiError && err.code === 'EMPLOYEE_NOT_FOUND') {
        setFormError(EMPLOYEE_NOT_FOUND_MESSAGE)
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
        const nextFieldErrors: SalaryFieldErrors = {}
        for (const detail of err.details as ValidationErrorDetail[]) {
          const field = detail.location[detail.location.length - 1]
          if (typeof field === 'string' && SALARY_CREATE_FIELDS.has(field)) {
            nextFieldErrors[field as keyof SalaryCreate] = detail.message
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
