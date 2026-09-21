import {
  DEFAULT_EMPLOYEE_SORT_BY,
  DEFAULT_EMPLOYEE_SORT_ORDER,
  EMPLOYEE_SORT_FIELDS,
} from '../../types/employee'
import type { SortOrder } from '../../types/employee'

interface EmployeeSortProps {
  sortBy: string
  sortOrder: SortOrder
  onSortByChange: (value: string) => void
  onSortOrderChange: (value: SortOrder) => void
  onReset: () => void
}

/**
 * Sorting controls for the employee listing: sort field + direction,
 * applied immediately on selection (a select change is already one
 * discrete action, same reasoning as `EmployeeFilters`' department/country
 * selects — no submit step needed). Owns no fetch logic itself
 * (`docs/architecture.md` Section 5.2); sorting always happens server-side
 * (`EmployeeListPage`/`useEmployeeList`), never by re-ordering the
 * currently-displayed page client-side, so the active sort always reflects
 * the full filtered result set, not just what's visible.
 *
 * `sortBy` options come from `EMPLOYEE_SORT_FIELDS`, a hand-mirrored copy
 * of the backend's allowlist (see that constant's doc comment) — never an
 * invented field the backend wouldn't accept.
 */
export function EmployeeSort({ sortBy, sortOrder, onSortByChange, onSortOrderChange, onReset }: EmployeeSortProps) {
  const isDefaultSort = sortBy === DEFAULT_EMPLOYEE_SORT_BY && sortOrder === DEFAULT_EMPLOYEE_SORT_ORDER
  const activeFieldLabel =
    EMPLOYEE_SORT_FIELDS.find((field) => field.value === sortBy)?.label ?? sortBy

  return (
    <div className="employee-sort" role="group" aria-label="Sort employees">
      <div className="field">
        <label htmlFor="employee-sort-field">Sort by</label>
        <select
          id="employee-sort-field"
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value)}
        >
          {EMPLOYEE_SORT_FIELDS.map((field) => (
            <option key={field.value} value={field.value}>
              {field.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="employee-sort-order">Sort order</label>
        <select
          id="employee-sort-order"
          value={sortOrder}
          onChange={(event) => onSortOrderChange(event.target.value as SortOrder)}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      {!isDefaultSort ? (
        <button type="button" className="btn btn-sm" onClick={onReset}>
          Reset sorting
        </button>
      ) : null}

      <p className="employee-sort__summary" aria-live="polite">
        Sorted by {activeFieldLabel} ({sortOrder === 'asc' ? 'ascending' : 'descending'})
      </p>
    </div>
  )
}
