import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEmployeeDetails } from '../hooks/useEmployeeDetails'
import { formatEmployeeName, formatPlainAmount } from '../utils/formatting'

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  terminated: 'Terminated',
}

/**
 * Employee details page: one employee's core fields plus their current
 * salary, from the combined `GET /employees/{id}/details` endpoint
 * (`hooks/useEmployeeDetails.ts`). Salary history/trend information is out
 * of scope (`docs/requirements.md` Section 6.2) — only the current salary
 * amount and currency, exactly as the backend returns them, are shown; no
 * calculation happens here (`utils/formatting.ts`'s helpers only format,
 * never derive, a value).
 */
export function EmployeeDetailsPage() {
  const { employeeId } = useParams<{ employeeId: string }>()
  const parsedEmployeeId = Number(employeeId)

  const { data, isLoading, error, notFound, salaryUnavailable, retry } =
    useEmployeeDetails(parsedEmployeeId)

  useDocumentTitle(data ? `${formatEmployeeName(data.employee)} - PayScope` : 'Employee details - PayScope')

  return (
    <section aria-labelledby="employee-details-heading">
      <p className="employee-details__back-link">
        <Link to="/employees">&larr; Back to employee listing</Link>
      </p>

      <h1 id="employee-details-heading">{data ? formatEmployeeName(data.employee) : 'Employee details'}</h1>

      {isLoading ? (
        <LoadingIndicator label="Loading employee details…" />
      ) : notFound ? (
        <EmptyState message={`Employee ${employeeId} could not be found.`} />
      ) : salaryUnavailable ? (
        <>
          <EmptyState message="This employee has no salary record on file, so their details can't be shown." />
          <p className="employee-details__actions">
            <Link to={`/employees/${employeeId}/salary/new`}>Add salary</Link>
          </p>
        </>
      ) : error ? (
        <ErrorMessage message={error} onRetry={retry} />
      ) : data ? (
        <>
          <section aria-labelledby="employee-details-info-heading">
            <h2 id="employee-details-info-heading">Employee</h2>
            <dl className="employee-details__list">
              <div>
                <dt>Employee code</dt>
                <dd>{data.employee.employee_code}</dd>
              </div>
              <div>
                <dt>First name</dt>
                <dd>{data.employee.first_name}</dd>
              </div>
              <div>
                <dt>Last name</dt>
                <dd>{data.employee.last_name}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{data.employee.department}</dd>
              </div>
              <div>
                <dt>Country</dt>
                <dd>{data.employee.country}</dd>
              </div>
              <div>
                <dt>Job title</dt>
                <dd>{data.employee.job_title}</dd>
              </div>
              <div>
                <dt>Employment status</dt>
                <dd>
                  {EMPLOYMENT_STATUS_LABELS[data.employee.employment_status] ?? data.employee.employment_status}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="employee-details-salary-heading">
            <h2 id="employee-details-salary-heading">Current salary</h2>
            <dl className="employee-details__list">
              <div>
                <dt>Salary amount</dt>
                <dd>{formatPlainAmount(data.salary.amount)}</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{data.salary.currency}</dd>
              </div>
            </dl>
            <p className="employee-details__actions">
              <Link to={`/employees/${employeeId}/salary/edit`}>Edit salary</Link>
            </p>
          </section>
        </>
      ) : null}
    </section>
  )
}
