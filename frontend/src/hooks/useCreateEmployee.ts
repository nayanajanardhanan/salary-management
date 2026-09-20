import { useCallback, useState } from 'react'
import { createEmployee } from '../api/employees'
import { ApiError } from '../api/client'
import type { EmployeeCreate, EmployeeRead } from '../types/employee'

type EmployeeFieldErrors = Partial<Record<keyof EmployeeCreate, string>>

interface ValidationErrorDetail {
  location: unknown[]
  message: string
  type: string
}

export interface UseCreateEmployeeResult {
  /** True while the create request is in flight — disable the submit button on this, not just track it manually. */
  isSubmitting: boolean
  /** A failure that isn't tied to one field (network failure, unexpected 5xx, unauthorized, or a 422 that didn't map to a known field). */
  formError: string | null
  /** Per-field messages from the backend — a duplicate `employee_code`, or field-level `422` validation details. */
  fieldErrors: EmployeeFieldErrors
  /** Submits `data`; returns the created employee on success, or `null` on failure (inspect `formError`/`fieldErrors` for why). */
  submit: (data: EmployeeCreate) => Promise<EmployeeRead | null>
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong while creating the employee. Please try again.'

const EMPLOYEE_CREATE_FIELDS: ReadonlySet<string> = new Set<keyof EmployeeCreate>([
  'employee_code',
  'first_name',
  'last_name',
  'department',
  'country',
  'job_title',
  'employment_status',
])

/**
 * Encapsulates submission state for the employee creation form
 * (`pages/EmployeeCreatePage.tsx`), mirroring this codebase's other data
 * hooks (`docs/architecture.md` Section 5.4) but for a one-shot mutation
 * rather than a subscription-style fetch: no `cancelled`-flag guard is
 * needed since nothing else re-triggers `submit`, and there's no `retry`
 * — resubmitting is just calling `submit` again from the form. A `401` is
 * already handled centrally by the shared client (`../api/client.ts`),
 * which clears the session and flips the app to the unauthenticated
 * state — this hook doesn't special-case it, same as every other data
 * hook here.
 *
 * Distinguishes three failure shapes from the backend (`api/employees.ts`'s
 * `createEmployee` doc comment):
 * - `EMPLOYEE_CODE_ALREADY_EXISTS` (`409`): attached to the `employee_code`
 *   field specifically, since that's exactly what's wrong and where.
 * - `VALIDATION_ERROR` (`422`, from `RequestValidationError`): each
 *   `details` entry's `location` ends with the offending field name (e.g.
 *   `["body", "employee_code"]`); mapped to that field when recognized,
 *   otherwise folded into `formError` so nothing is silently dropped.
 * - anything else (network failure, `401`, unexpected `500`, etc.): a
 *   single `formError`, using the normalized `ApiError` message when
 *   there is one.
 */
export function useCreateEmployee(): UseCreateEmployeeResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<EmployeeFieldErrors>({})

  const submit = useCallback(async (data: EmployeeCreate): Promise<EmployeeRead | null> => {
    setIsSubmitting(true)
    setFormError(null)
    setFieldErrors({})

    try {
      const employee = await createEmployee(data)
      return employee
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMPLOYEE_CODE_ALREADY_EXISTS') {
        setFieldErrors({ employee_code: err.message })
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
        const nextFieldErrors: EmployeeFieldErrors = {}
        for (const detail of err.details as ValidationErrorDetail[]) {
          const field = detail.location[detail.location.length - 1]
          if (typeof field === 'string' && EMPLOYEE_CREATE_FIELDS.has(field)) {
            nextFieldErrors[field as keyof EmployeeCreate] = detail.message
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
