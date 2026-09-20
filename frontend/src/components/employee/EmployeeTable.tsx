import { Link } from 'react-router-dom'
import type { EmployeeListItem } from '../../types/employee'
import { formatEmployeeName, formatSalaryAmount } from '../../utils/formatting'

interface EmployeeTableProps {
  employees: EmployeeListItem[]
}

/**
 * Presentational table for a page of employees (`docs/architecture.md`
 * Section 5.2): receives data via props, does not fetch it itself. Shows
 * the minimum fields Acceptance Criterion 8.1 requires — name, department,
 * country, salary amount, and currency — with no search/filter/sort UI.
 * Each employee's name links to `/employees/:id` (`pages/EmployeeDetailsPage.tsx`),
 * the only navigation this table owns.
 */
export function EmployeeTable({ employees }: EmployeeTableProps) {
  return (
    // A focusable, scrollable wrapper (rather than `display: block` on the
    // table itself) keeps the table's native accessibility semantics intact
    // while still supporting keyboard scrolling at narrow widths.
    <div className="employee-table-scroll" tabIndex={0} role="region" aria-label="Employees, scrollable table">
      <table className="employee-table">
        <caption>Employees, with department, country, and current salary</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Department</th>
            <th scope="col">Country</th>
            <th scope="col">Salary</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <th scope="row">
                <Link to={`/employees/${employee.id}`}>{formatEmployeeName(employee)}</Link>
              </th>
              <td>{employee.department}</td>
              <td>{employee.country}</td>
              <td>
                {employee.salary
                  ? formatSalaryAmount(employee.salary.amount, employee.salary.currency)
                  : 'Not set'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
