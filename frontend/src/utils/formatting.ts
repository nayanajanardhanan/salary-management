import type { EmployeeListItem } from '../types/employee'

/** `"First Last"`, for display purposes only (not a stored field). */
export function formatEmployeeName(employee: Pick<EmployeeListItem, 'first_name' | 'last_name'>): string {
  return `${employee.first_name} ${employee.last_name}`
}

/**
 * Formats a salary amount together with its currency code, without
 * converting or combining it with any other currency (`docs/requirements.md`
 * Section 5). `currencyDisplay: 'code'` shows the ISO code (e.g. "USD")
 * rather than a symbol, since the same symbol (e.g. "$") is shared by
 * multiple currencies in this listing and would be ambiguous.
 *
 * Falls back to a plain "<amount> <currency>" string if `currency` isn't a
 * code `Intl.NumberFormat` recognizes, or `amount` isn't numeric — this
 * never throws, since it renders directly in the employee table.
 */
export function formatSalaryAmount(amount: string, currency: string): string {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) {
    return `${amount} ${currency}`
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    }).format(numeric)
  } catch {
    return `${numeric.toLocaleString()} ${currency}`
  }
}

/**
 * Formats a bare salary amount with no currency symbol/code — for a field
 * displayed right next to its own separate "Currency" field (e.g. the
 * employee details page), where `formatSalaryAmount`'s bundled currency
 * code would be redundant. Never used on its own without the currency
 * shown nearby (`docs/requirements.md` Section 5, FR-2.3).
 */
export function formatPlainAmount(amount: string): string {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) {
    return amount
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)
}
