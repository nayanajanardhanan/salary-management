import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { EmployeeListItem } from '../../types/employee'
import { EmployeeTable } from './EmployeeTable'

const employees: EmployeeListItem[] = [
  {
    id: 1,
    employee_code: 'EMP-001',
    first_name: 'Ada',
    last_name: 'Lovelace',
    department: 'Engineering',
    country: 'United Kingdom',
    job_title: 'Software Engineer',
    employment_status: 'active',
    salary: { employee_id: 1, amount: '95000.00', currency: 'GBP' },
  },
  {
    id: 2,
    employee_code: 'EMP-002',
    first_name: 'Grace',
    last_name: 'Hopper',
    department: 'Research',
    country: 'United States',
    job_title: 'Rear Admiral',
    employment_status: 'active',
    salary: null,
  },
]

describe('EmployeeTable', () => {
  it('renders a semantic table with an accessible name and column headers', () => {
    render(<EmployeeTable employees={employees} />)

    const table = screen.getByRole('table', { name: /employees/i })
    expect(table).toBeInTheDocument()

    const headings = ['Name', 'Department', 'Country', 'Salary']
    for (const heading of headings) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument()
    }
  })

  it('displays employee name, department, country, salary amount, and currency', () => {
    render(<EmployeeTable employees={employees} />)

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('United Kingdom')).toBeInTheDocument()

    const salaryCell = screen.getByRole('cell', { name: /GBP/ })
    expect(salaryCell).toHaveTextContent('95,000.00')
    expect(salaryCell).toHaveTextContent('GBP')
  })

  it('shows a fallback for an employee with no salary record, without inventing a value', () => {
    render(<EmployeeTable employees={employees} />)

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })
})
