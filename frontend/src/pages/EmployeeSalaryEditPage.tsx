import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { ArrowLeftIcon, CheckCircleIcon } from '../components/common/icons'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployeeDetails } from '../hooks/useEmployeeDetails'
import { useUpdateSalary } from '../hooks/useUpdateSalary'
import { SUPPORTED_CURRENCY_CODES } from '../types/employee'
import type { EmployeeRead, Salary, SalaryUpdate } from '../types/employee'
import { formatEmployeeName, formatSalaryAmount } from '../utils/formatting'

const SALARY_FIELDS = ['amount', 'currency'] as const

type SalaryField = (typeof SALARY_FIELDS)[number]

const FIELD_LABELS: Record<SalaryField, string> = {
  amount: 'Salary amount',
  currency: 'Currency',
}

type SalaryFormValues = Record<SalaryField, string>

type FieldErrors = Partial<Record<SalaryField, string>>

/**
 * Matches `app.schemas.salary.SalaryUpdate.amount`'s constraints
 * (`max_digits=12`, `decimal_places=2`, `ge=0`): a non-negative number with
 * at most 10 integer digits and up to 2 decimal digits. The leading-minus
 * case is rejected simply by never matching it.
 */
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/

/**
 * Client-side mirror of `SalaryUpdate`'s validation rules — checked here
 * only for immediate feedback; the backend's own schema validation
 * (`app.schemas.salary.SalaryUpdate`) remains the final source of truth
 * (`hooks/useUpdateSalary.ts` surfaces whatever it rejects, the same way,
 * for anything this misses, including currency support since the
 * `<select>` options already come from the mirrored
 * `SUPPORTED_CURRENCY_CODES`).
 */
function validate(values: SalaryFormValues): FieldErrors {
  const errors: FieldErrors = {}

  const amount = values.amount.trim()
  if (!amount) {
    errors.amount = `${FIELD_LABELS.amount} is required.`
  } else if (!AMOUNT_PATTERN.test(amount)) {
    errors.amount = 'Enter a non-negative amount with up to 2 decimal places.'
  }

  if (!values.currency) {
    errors.currency = `${FIELD_LABELS.currency} is required.`
  }

  return errors
}

interface SalaryEditFormProps {
  employee: EmployeeRead
  salary: Salary
  onUpdated: (salary: Salary) => void
}

/**
 * The actual edit form, split out so its state can be initialized directly
 * from the already-loaded `salary`/`employee` — mounted only once
 * `EmployeeSalaryEditPage` has data to show. Initializing `values` from
 * props here (rather than an effect that copies `salary` into state after
 * this component is already mounted) means there's no window where the
 * fields render empty and then jump to their current values, and no risk
 * of a later effect run clobbering an edit the user already started typing.
 */
function SalaryEditForm({ employee, salary, onUpdated }: SalaryEditFormProps) {
  const [values, setValues] = useState<SalaryFormValues>({ amount: salary.amount, currency: salary.currency })
  const [clientErrors, setClientErrors] = useState<FieldErrors>({})
  const { isSubmitting, formError, fieldErrors: serverFieldErrors, submit } = useUpdateSalary()

  const fieldErrors: FieldErrors = { ...clientErrors, ...serverFieldErrors }
  const fieldRefs = useRef<Partial<Record<SalaryField, HTMLInputElement | HTMLSelectElement | null>>>({})

  // Moves focus to the first invalid field, whether the error came from
  // client-side validation (submit) or the backend (a 422 this form's own
  // validation didn't catch) — one mechanism for both.
  useEffect(() => {
    const firstInvalidField = SALARY_FIELDS.find((field) => fieldErrors[field])
    if (firstInvalidField) {
      fieldRefs.current[firstInvalidField]?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientErrors, serverFieldErrors])

  function handleChange(field: SalaryField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    const errors = validate(values)
    setClientErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    const payload: SalaryUpdate = {
      amount: values.amount.trim(),
      currency: values.currency,
    }

    const updated = await submit(employee.id, payload)
    if (updated) {
      onUpdated(updated)
    }
  }

  return (
    <>
      <p className="form-identity">
        Editing the salary for <strong>{formatEmployeeName(employee)}</strong> ({employee.employee_code}). Current
        salary: <strong>{formatSalaryAmount(salary.amount, salary.currency)}</strong>.
      </p>

      <form className="salary-edit-form form-card" onSubmit={handleSubmit} noValidate>
        <p className="salary-edit-form__required-note">
          Fields marked <span className="required-mark" aria-hidden="true">*</span> are required.
        </p>

        <div className="field">
          <label htmlFor="salary-edit-amount-input">
            {FIELD_LABELS.amount} <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="salary-edit-amount-input"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            aria-required="true"
            value={values.amount}
            onChange={(event) => handleChange('amount', event.target.value)}
            aria-invalid={fieldErrors.amount ? true : undefined}
            aria-describedby={fieldErrors.amount ? 'salary-edit-amount-error' : undefined}
            ref={(element) => {
              fieldRefs.current.amount = element
            }}
          />
          {fieldErrors.amount ? (
            <p id="salary-edit-amount-error" className="field-error" role="alert">
              {fieldErrors.amount}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="salary-edit-currency-input">
            {FIELD_LABELS.currency} <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <select
            id="salary-edit-currency-input"
            name="currency"
            required
            aria-required="true"
            value={values.currency}
            onChange={(event) => handleChange('currency', event.target.value)}
            aria-invalid={fieldErrors.currency ? true : undefined}
            aria-describedby={fieldErrors.currency ? 'salary-edit-currency-error' : undefined}
            ref={(element) => {
              fieldRefs.current.currency = element
            }}
          >
            <option value="">Select a currency</option>
            {SUPPORTED_CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {fieldErrors.currency ? (
            <p id="salary-edit-currency-error" className="field-error" role="alert">
              {fieldErrors.currency}
            </p>
          ) : null}
        </div>

        {formError ? <ErrorMessage message={formError} /> : null}

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Saving changes…
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </form>
    </>
  )
}

/**
 * Salary editing page for a single, existing employee
 * (`PUT /employees/{id}/salary`, full replacement — `docs/requirements.md`
 * FR-2.2). Reached from `EmployeeDetailsPage`'s "Edit salary" link, shown
 * only while the employee already has a salary record — loading is done
 * via `useEmployeeDetails` (the same combined employee+salary fetch the
 * details page uses), which 404s the whole request if the employee has no
 * salary yet, matching this endpoint's own "update only, never create"
 * semantics. This never creates a new salary record and never touches
 * salary history — only the two fields the backend accepts (`amount`,
 * `currency`) are collected, prefilled with the current values, and sent
 * exactly as entered.
 */
export function EmployeeSalaryEditPage() {
  const { employeeId } = useParams<{ employeeId: string }>()
  const parsedEmployeeId = Number(employeeId)

  const { data, isLoading, error, notFound, salaryUnavailable, retry } = useEmployeeDetails(parsedEmployeeId)
  useDocumentTitle(
    data ? `Edit Salary - ${formatEmployeeName(data.employee)} - PayScope` : 'Edit Salary - PayScope',
  )

  const [updatedSalary, setUpdatedSalary] = useState<Salary | null>(null)

  if (updatedSalary && data) {
    return (
      <section aria-labelledby="salary-edit-heading">
        <h1 id="salary-edit-heading">Edit Salary</h1>
        <div className="success-panel" role="status">
          <span className="success-panel__icon" aria-hidden="true">
            <CheckCircleIcon width={20} height={20} />
          </span>
          <div className="success-panel__body">
            <p>
              The salary for <strong>{formatEmployeeName(data.employee)}</strong> (
              {data.employee.employee_code}) was updated to{' '}
              <strong>{formatSalaryAmount(updatedSalary.amount, updatedSalary.currency)}</strong>.
            </p>
            <p className="salary-edit__success-actions">
              <Link to={`/employees/${data.employee.id}`}>View employee details</Link>
              {' · '}
              <Link to="/employees">Back to employee listing</Link>
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="salary-edit-heading">
      {notFound ? (
        <Link to="/employees" className="back-link">
          <ArrowLeftIcon width={16} height={16} />
          Back to employee listing
        </Link>
      ) : (
        <Link to={`/employees/${employeeId}`} className="back-link">
          <ArrowLeftIcon width={16} height={16} />
          Back to employee details
        </Link>
      )}

      <div className="page-header">
        <div className="page-header__text">
          <h1 id="salary-edit-heading">Edit Salary</h1>
        </div>
      </div>

      {isLoading ? (
        <LoadingIndicator label="Loading salary…" />
      ) : notFound ? (
        <EmptyState message={`Employee ${employeeId} could not be found.`} />
      ) : salaryUnavailable ? (
        <>
          <EmptyState message="This employee has no salary record to edit yet." />
          <p className="salary-edit__actions">
            <Link to={`/employees/${employeeId}/salary/new`} className="btn btn-primary">
              Add salary
            </Link>
          </p>
        </>
      ) : error ? (
        <ErrorMessage message={error} onRetry={retry} />
      ) : data ? (
        <SalaryEditForm employee={data.employee} salary={data.salary} onUpdated={setUpdatedSalary} />
      ) : null}
    </section>
  )
}
