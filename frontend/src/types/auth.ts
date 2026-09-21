/** Mirrors `app.schemas.auth.LoginRequest` — the request body for `POST /api/v1/auth/login`. */
export interface LoginRequest {
  username_or_email: string
  password: string
}

/**
 * Mirrors `app.schemas.auth.TokenResponse` — the response body for a
 * successful login. Never carries the HR user's own fields (no
 * `password_hash`, deliberately never returned by the backend either).
 */
export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
}
