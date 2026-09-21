import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { useDeleteSalary } from '../hooks/useDeleteSalary'
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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [justDeletedSalary, setJustDeletedSalary] = useState(false)
  const { isDeleting, error: deleteError, submit: deleteSalary, reset: resetDeleteError } = useDeleteSalary()
  const deleteSuccessRef = useRef<HTMLParagraphElement | null>(null)

  // Moves focus to the "salary deleted" confirmation once the refreshed
  // details settle into the no-salary state, so a screen reader user gets
  // clear confirmation the deletion actually happened (`retry`, called from
  // `handleConfirmDelete`, is what gets the page there).
  useEffect(() => {
    if (salaryUnavailable && justDeletedSalary) {
      deleteSuccessRef.current?.focus()
    }
  }, [salaryUnavailable, justDeletedSalary])

  function handleOpenDeleteDialog() {
    setIsDeleteDialogOpen(true)
  }

  function handleCancelDelete() {
    setIsDeleteDialogOpen(false)
    resetDeleteError()
  }

  async function handleConfirmDelete() {
    const success = await deleteSalary(parsedEmployeeId)
    if (success) {
      setIsDeleteDialogOpen(false)
      setJustDeletedSalary(true)
      retry()
    }
  }

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
          {justDeletedSalary ? (
            <p className="employee-details__delete-success" role="status" tabIndex={-1} ref={deleteSuccessRef}>
              Salary deleted successfully.
            </p>
          ) : null}
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
              <button type="button" className="employee-details__delete-salary-button" onClick={handleOpenDeleteDialog}>
                Delete salary
              </button>
            </p>
          </section>
        </>
      ) : null}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete salary record?"
        description={
          data ? (
            <>
              This will permanently remove the current salary record for{' '}
              <strong>{formatEmployeeName(data.employee)}</strong> ({data.employee.employee_code}). The employee
              record itself will not be deleted. This action cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete salary"
        confirmingLabel="Deleting…"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isConfirming={isDeleting}
        error={deleteError}
      />
    </section>
  )
}
