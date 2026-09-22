import type { FormEvent } from 'react'
import { SearchIcon } from '../common/icons'

interface EmployeeSearchProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onClear: () => void
}

/**
 * Controlled search form for the employee listing (`docs/requirements.md`
 * FR-3.1-FR-3.2): renders the input and submit/clear actions but owns no
 * fetch logic or state itself (`docs/architecture.md` Section 5.2) —
 * `EmployeeListPage` decides when a search is actually applied. Submitting
 * (via the button or Enter) rather than firing a request per keystroke
 * keeps request timing simple and avoids an extra debounce dependency.
 */
export function EmployeeSearch({ value, onChange, onSubmit, onClear }: EmployeeSearchProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="employee-search" role="search" onSubmit={handleSubmit}>
      <div className="field field-grow">
        <label htmlFor="employee-search-input">Search employees</label>
        <div className="input-with-icon">
          <SearchIcon width={16} height={16} />
          <input
            id="employee-search-input"
            type="search"
            name="search"
            placeholder="Search by employee name or employee ID"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
      <button type="submit" className="btn btn-primary">
        Search
      </button>
      <button type="button" className="btn" onClick={onClear} disabled={value === ''}>
        Clear search
      </button>
    </form>
  )
}
