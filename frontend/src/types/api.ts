/**
 * Mirrors the backend's shared error envelope (`app.schemas.error.ErrorResponse`),
 * returned by every endpoint on failure. Business response shapes (employees,
 * salaries, analytics) are added alongside the feature that consumes them,
 * not here.
 */
export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    details: unknown
  }
}
