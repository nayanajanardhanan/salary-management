import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { ArrowLeftIcon, CheckCircleIcon } from '../components/common/icons'
import { useCreateSalary } from '../hooks/useCreateSalary'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployee } from '../hooks/useEmployee'
import { SUPPORTED_CURRENCY_CODES } from '../types/employee'
import type { Salary, SalaryCreate } from '../types/employee'
import { formatEmployeeName, formatSalaryAmount } from '../utils/formatting'

const SALARY_FIELDS = ['amount', 'currency'] as const

type SalaryField = (typeof SALARY_FIELDS)[number]

const FIELD_LABELS: Record<SalaryField, string> = {
  amount: 'Salary amount',
  currency: 'Currency',
}

type SalaryFormValues = Record<SalaryField, string>

const EMPTY_FORM: SalaryFormValues = { amount: '', currency: '' }

type FieldErrors = Partial<Record<SalaryField, string>>

/**
 * Matches `app.schemas.salary.SalaryCreate.amount`'s constraints
 * (`max_digits=12`, `decimal_places=2`, `ge=0`): a non-negative number with
 * at most 10 integer digits and up to 2 decimal digits. The leading-minus
 * case is rejected simply by never matching it.
 */
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/

/**
 * Client-side mirror of `SalaryCreate`'s validation rules — checked here
 * only for immediate feedback; the backend's own schema validation
 * (`app.schemas.salary.SalaryCreate`) remains the final source of truth
 * (`hooks/useCreateSalary.ts` surfaces whatever it rejects, the same way,
 * for anything this misses, including currency support since the `<select>`
 * options already come from the mirrored `SUPPORTED_CURRENCY_CODES`).
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

/**
 * Salary creation form for a single, existing employee
 * (`POST /employees/{id}/salary`, `docs/requirements.md` FR-2.2). Reached
 * from `EmployeeDetailsPage`'s "Add salary" link, shown only while the
 * employee has no salary yet — the one-active-salary-per-employee rule
 * itself is enforced by the backend, not re-implemented here; visiting this
 * page directly for an employee that already has one still works, and the
 * backend's `409` surfaces as a form-level message
 * (`hooks/useCreateSalary.ts`). No salary calculation or history happens
 * here — only the two fields the backend accepts (`amount`, `currency`) are
 * collected and sent exactly as entered.
 */
export function EmployeeSalaryCreatePage() {
  const { employeeId } = useParams<{ employeeId: string }>()
  const parsedEmployeeId = Number(employeeId)

  const { employee, isLoading, error, notFound, retry } = useEmployee(parsedEmployeeId)
  useDocumentTitle(employee ? `Add Salary - ${formatEmployeeName(employee)} - PayScope` : 'Add Salary - PayScope')

  const [values, setValues] = useState<SalaryFormValues>(EMPTY_FORM)
  const [clientErrors, setClientErrors] = useState<FieldErrors>({})
  const [createdSalary, setCreatedSalary] = useState<Salary | null>(null)
  const { isSubmitting, formError, fieldErrors: serverFieldErrors, submit } = useCreateSalary()

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
    if (isSubmitting || !employee) {
      return
    }

    const errors = validate(values)
    setClientErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    const payload: SalaryCreate = {
      amount: values.amount.trim(),
      currency: values.currency,
    }

    const salary = await submit(employee.id, payload)
    if (salary) {
      setCreatedSalary(salary)
    }
  }

  if (createdSalary && employee) {
    return (
      <section aria-labelledby="salary-create-heading">
        <h1 id="salary-create-heading">Add Salary</h1>
        <div className="success-panel" role="status">
          <span className="success-panel__icon" aria-hidden="true">
            <CheckCircleIcon width={20} height={20} />
          </span>
          <div className="success-panel__body">
            <p>
              A salary of <strong>{formatSalaryAmount(createdSalary.amount, createdSalary.currency)}</strong> was
              added for <strong>{formatEmployeeName(employee)}</strong> ({employee.employee_code}).
            </p>
            <p className="salary-create__success-actions">
              <Link to={`/employees/${employee.id}`}>View employee details</Link>
              {' · '}
              <Link to="/employees">Back to employee listing</Link>
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="salary-create-heading">
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
          <h1 id="salary-create-heading">Add Salary</h1>
        </div>
      </div>

      {isLoading ? (
        <LoadingIndicator label="Loading employee…" />
      ) : notFound ? (
        <EmptyState message={`Employee ${employeeId} could not be found.`} />
      ) : error ? (
        <ErrorMessage message={error} onRetry={retry} />
      ) : employee ? (
        <>
          <p className="form-identity">
            Adding a salary for <strong>{formatEmployeeName(employee)}</strong> ({employee.employee_code}).
          </p>

          <form className="salary-create-form form-card" onSubmit={handleSubmit} noValidate>
            <p className="salary-create-form__required-note">
              Fields marked <span className="required-mark" aria-hidden="true">*</span> are required.
            </p>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="salary-amount-input">
                  {FIELD_LABELS.amount} <span className="required-mark" aria-hidden="true">*</span>
                </label>
                <input
                  id="salary-amount-input"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  required
                  aria-required="true"
                  value={values.amount}
                  onChange={(event) => handleChange('amount', event.target.value)}
                  aria-invalid={fieldErrors.amount ? true : undefined}
                  aria-describedby={fieldErrors.amount ? 'salary-amount-error' : undefined}
                  ref={(element) => {
                    fieldRefs.current.amount = element
                  }}
                />
                {fieldErrors.amount ? (
                  <p id="salary-amount-error" className="field-error" role="alert">
                    {fieldErrors.amount}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="salary-currency-input">
                  {FIELD_LABELS.currency} <span className="required-mark" aria-hidden="true">*</span>
                </label>
                <select
                  id="salary-currency-input"
                  name="currency"
                  required
                  aria-required="true"
                  value={values.currency}
                  onChange={(event) => handleChange('currency', event.target.value)}
                  aria-invalid={fieldErrors.currency ? true : undefined}
                  aria-describedby={fieldErrors.currency ? 'salary-currency-error' : undefined}
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
                  <p id="salary-currency-error" className="field-error" role="alert">
                    {fieldErrors.currency}
                  </p>
                ) : null}
              </div>
            </div>

            {formError ? <ErrorMessage message={formError} /> : null}

            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  Adding salary…
                </>
              ) : (
                'Add salary'
              )}
            </button>
          </form>
        </>
      ) : null}
    </section>
  )
}
