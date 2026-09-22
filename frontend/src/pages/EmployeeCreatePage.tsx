import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { ArrowLeftIcon, CheckCircleIcon } from '../components/common/icons'
import { useCreateEmployee } from '../hooks/useCreateEmployee'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  DEFAULT_EMPLOYMENT_STATUS,
  EMPLOYMENT_STATUS_OPTIONS,
} from '../types/employee'
import type { EmployeeCreate, EmployeeRead, EmploymentStatus } from '../types/employee'
import { formatEmployeeName } from '../utils/formatting'

/** The required, free-text fields — in the order they appear in the form (and the order focus moves to the first invalid one). */
const TEXT_FIELDS = [
  'employee_code',
  'first_name',
  'last_name',
  'department',
  'country',
  'job_title',
] as const

type TextField = (typeof TEXT_FIELDS)[number]

const FIELD_LABELS: Record<TextField, string> = {
  employee_code: 'Employee code',
  first_name: 'First name',
  last_name: 'Last name',
  department: 'Department',
  country: 'Country',
  job_title: 'Job title',
}

/** Mirrors each field's `max_length` in `app.schemas.employee.EmployeeCreate`. */
const FIELD_MAX_LENGTHS: Record<TextField, number> = {
  employee_code: 20,
  first_name: 100,
  last_name: 100,
  department: 100,
  country: 100,
  job_title: 150,
}

type EmployeeFormValues = Record<TextField, string> & { employment_status: EmploymentStatus }

const EMPTY_FORM: EmployeeFormValues = {
  employee_code: '',
  first_name: '',
  last_name: '',
  department: '',
  country: '',
  job_title: '',
  employment_status: DEFAULT_EMPLOYMENT_STATUS,
}

type FieldErrors = Partial<Record<TextField, string>>

/**
 * Client-side mirror of `EmployeeCreate`'s required/non-empty and
 * `max_length` rules (`docs/requirements.md` FR-7.1) — checked here only to
 * give immediate, field-level feedback before a request is ever sent; the
 * backend's own schema validation (`app.schemas.employee.EmployeeCreate`)
 * remains the final source of truth (`hooks/useCreateEmployee.ts` surfaces
 * whatever it rejects, the same way, for anything this misses).
 */
function validate(values: EmployeeFormValues): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of TEXT_FIELDS) {
    const trimmed = values[field].trim()
    if (!trimmed) {
      errors[field] = `${FIELD_LABELS[field]} is required.`
    } else if (trimmed.length > FIELD_MAX_LENGTHS[field]) {
      errors[field] = `${FIELD_LABELS[field]} must be ${FIELD_MAX_LENGTHS[field]} characters or fewer.`
    }
  }
  return errors
}

/**
 * Employee creation form (`docs/requirements.md` FR-1.1/FR-7.1): every
 * field `POST /employees` (`app.schemas.employee.EmployeeCreate`) accepts,
 * no more, no less — there's no `email` field to add, since `Employee`
 * doesn't store one (checked against the actual schema, not assumed).
 * Salary is a separate resource/endpoint and explicitly out of scope here.
 */
export function EmployeeCreatePage() {
  useDocumentTitle('Add Employee - PayScope')

  const [values, setValues] = useState<EmployeeFormValues>(EMPTY_FORM)
  const [clientErrors, setClientErrors] = useState<FieldErrors>({})
  const [createdEmployee, setCreatedEmployee] = useState<EmployeeRead | null>(null)
  const { isSubmitting, formError, fieldErrors: serverFieldErrors, submit } = useCreateEmployee()

  const fieldErrors: FieldErrors = { ...clientErrors, ...serverFieldErrors }
  const fieldRefs = useRef<Partial<Record<TextField, HTMLInputElement | null>>>({})

  // Moves focus to the first invalid field, whether the error came from
  // client-side validation (submit) or the backend (duplicate employee
  // code, or a 422 this form's own validation didn't catch) — one
  // mechanism for both, since both ultimately land in `fieldErrors`.
  useEffect(() => {
    const firstInvalidField = TEXT_FIELDS.find((field) => fieldErrors[field])
    if (firstInvalidField) {
      fieldRefs.current[firstInvalidField]?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientErrors, serverFieldErrors])

  function handleChange(field: keyof EmployeeFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function renderField(field: TextField) {
    return (
      <div className="field" key={field}>
        <label htmlFor={`employee-${field}-input`}>
          {FIELD_LABELS[field]} <span className="required-mark" aria-hidden="true">*</span>
        </label>
        <input
          id={`employee-${field}-input`}
          name={field}
          type="text"
          required
          aria-required="true"
          maxLength={FIELD_MAX_LENGTHS[field]}
          value={values[field]}
          onChange={(event) => handleChange(field, event.target.value)}
          aria-invalid={fieldErrors[field] ? true : undefined}
          aria-describedby={fieldErrors[field] ? `employee-${field}-error` : undefined}
          ref={(element) => {
            fieldRefs.current[field] = element
          }}
        />
        {fieldErrors[field] ? (
          <p id={`employee-${field}-error`} className="field-error" role="alert">
            {fieldErrors[field]}
          </p>
        ) : null}
      </div>
    )
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

    const payload: EmployeeCreate = {
      employee_code: values.employee_code.trim(),
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      department: values.department.trim(),
      country: values.country.trim(),
      job_title: values.job_title.trim(),
      employment_status: values.employment_status,
    }

    const employee = await submit(payload)
    if (employee) {
      setCreatedEmployee(employee)
    }
  }

  if (createdEmployee) {
    return (
      <section aria-labelledby="employee-create-heading">
        <h1 id="employee-create-heading">Add Employee</h1>
        <div className="success-screen">
          <div className="success-panel" role="status">
            <span className="success-panel__icon" aria-hidden="true">
              <CheckCircleIcon width={28} height={28} />
            </span>
            <p className="success-panel__title">Employee created</p>
            <p className="success-panel__message">
              Employee <strong>{formatEmployeeName(createdEmployee)}</strong> (
              {createdEmployee.employee_code}) was created successfully.
            </p>
            <div className="success-panel__actions">
              <Link to={`/employees/${createdEmployee.id}`} className="btn btn-primary">
                View employee details
              </Link>
              <Link to="/employees" className="btn">
                Back to employee listing
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="employee-create-heading">
      <Link to="/employees" className="back-link">
        <ArrowLeftIcon width={16} height={16} />
        Back to employee listing
      </Link>

      <div className="page-header">
        <div className="page-header__text">
          <h1 id="employee-create-heading">Add Employee</h1>
          <p className="page-header__description">Create a new employee record.</p>
        </div>
      </div>

      <form className="employee-create-form form-card form-card-wide" onSubmit={handleSubmit} noValidate>
        <p className="employee-create-form__required-note">
          Fields marked <span className="required-mark" aria-hidden="true">*</span> are required.
        </p>

        <div className="form-section">
          <h2 className="form-section__title">Identity</h2>
          <div className="form-grid form-grid--3col">
            {renderField('employee_code')}
            {renderField('first_name')}
            {renderField('last_name')}
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section__title">Assignment</h2>
          <div className="form-grid">
            {renderField('department')}
            {renderField('country')}
            {renderField('job_title')}
            <div className="field">
              <label htmlFor="employee-employment-status-input">Employment status</label>
              <select
                id="employee-employment-status-input"
                name="employment_status"
                value={values.employment_status}
                onChange={(event) => handleChange('employment_status', event.target.value)}
              >
                {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {formError ? <ErrorMessage message={formError} /> : null}

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Creating employee…
            </>
          ) : (
            'Create employee'
          )}
        </button>
      </form>
    </section>
  )
}
