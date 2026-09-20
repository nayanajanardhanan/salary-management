/**
 * Mirrors `app.schemas.analytics`. `average`/`minimum`/`maximum` are decimal
 * amounts, serialized by the backend as strings, matching how
 * `types/employee.ts` types `Salary.amount` (not used by this feature, kept
 * for shape fidelity with the backend response).
 */

export interface CurrencySalaryStats {
  currency: string
  count: number
  average: string
  minimum: string
  maximum: string
}

/** Mirrors `app.schemas.analytics.DepartmentSalaryStats`. */
export interface DepartmentSalaryStats extends CurrencySalaryStats {
  department: string
}

/** Mirrors `app.schemas.analytics.CountrySalaryStats`. */
export interface CountrySalaryStats extends CurrencySalaryStats {
  country: string
}

/** Mirrors `app.schemas.analytics.SalaryStatistics`. */
export interface SalaryStatistics {
  overall: CurrencySalaryStats[]
  by_department: DepartmentSalaryStats[]
  by_country: CountrySalaryStats[]
}
