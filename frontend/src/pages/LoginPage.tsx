import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { ChartIcon, EyeIcon, EyeOffIcon, ShieldIcon, UsersIcon, ChartIcon as StatsIcon } from '../components/common/icons'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLogin } from '../hooks/useLogin'

interface LocationState {
  from?: string
}

interface FieldErrors {
  usernameOrEmail?: string
  password?: string
}

/**
 * Username/email + password sign-in form (replaces the previous manual
 * access-token entry entirely — there is no token field anywhere on this
 * page, and the issued token is never shown to the user). Submits via
 * `useLogin` (`../hooks/useLogin.ts`), which only calls the shared
 * `useAuth().login` once the backend has actually confirmed the
 * credentials, and reuses the existing `AuthContext`/`ProtectedRoute`
 * machinery unchanged for everything after that.
 */
export function LoginPage() {
  useDocumentTitle('Sign in - PayScope')

  const { isAuthenticated, sessionExpired } = useAuth()
  const { isSubmitting, formError, submit } = useLogin()
  const location = useLocation()

  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const usernameInputId = useId()
  const passwordInputId = useId()
  const usernameErrorId = useId()
  const passwordErrorId = useId()
  const formErrorId = useId()

  if (isAuthenticated) {
    const redirectTo = (location.state as LocationState | null)?.from ?? '/'
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    const trimmedUsernameOrEmail = usernameOrEmail.trim()
    const errors: FieldErrors = {}
    if (!trimmedUsernameOrEmail) {
      errors.usernameOrEmail = 'Enter your username or email.'
    }
    if (!password) {
      errors.password = 'Enter your password.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    await submit(trimmedUsernameOrEmail, password)
  }

  const topLevelError =
    formError ??
    (sessionExpired ? 'Your session has expired. Please sign in again.' : null)

  return (
    <div className="auth-page">
      <section className="auth-page__panel" aria-hidden="true">
        <div className="auth-page__panel-brand">
          <span className="auth-page__panel-mark">
            <ChartIcon width={22} height={22} />
          </span>
          PayScope
        </div>
        <div className="auth-page__panel-copy">
          <h2>Salary management, without the spreadsheets.</h2>
          <p>
            One authenticated workspace for HR to manage employees, keep salary records accurate, and
            understand compensation across departments and countries.
          </p>
          <ul className="auth-page__panel-list">
            <li>
              <UsersIcon width={16} height={16} />
              Search, filter, and manage every employee record
            </li>
            <li>
              <ShieldIcon width={16} height={16} />
              Salary data protected behind authenticated access
            </li>
            <li>
              <StatsIcon width={16} height={16} />
              Compensation analytics by department and country
            </li>
          </ul>
        </div>
        <p className="auth-page__panel-footer">PayScope · Internal HR tool</p>
      </section>

      <main className="auth-page__form-side">
        <div className="auth-card">
          <div className="auth-card__brand">
            <span className="auth-card__brand-mark">
              <ChartIcon width={16} height={16} />
            </span>
            PayScope
          </div>

          <section aria-labelledby="login-heading">
            <h1 id="login-heading">Sign in to PayScope</h1>
            <p>Sign in with your HR username or email and password.</p>
            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor={usernameInputId}>Username or email</label>
                <input
                  id={usernameInputId}
                  name="usernameOrEmail"
                  type="text"
                  autoComplete="username"
                  value={usernameOrEmail}
                  onChange={(event) => setUsernameOrEmail(event.target.value)}
                  aria-describedby={fieldErrors.usernameOrEmail ? usernameErrorId : undefined}
                  aria-invalid={fieldErrors.usernameOrEmail ? true : undefined}
                />
                {fieldErrors.usernameOrEmail ? (
                  <p id={usernameErrorId} className="field-error" role="alert">
                    {fieldErrors.usernameOrEmail}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor={passwordInputId}>Password</label>
                <div className="input-trailing-only">
                  <input
                    id={passwordInputId}
                    name="password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
                    aria-invalid={fieldErrors.password ? true : undefined}
                  />
                  <button
                    type="button"
                    className="input-trailing-btn"
                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                    aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={isPasswordVisible}
                  >
                    {isPasswordVisible ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p id={passwordErrorId} className="field-error" role="alert">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>

              {topLevelError ? (
                <div id={formErrorId}>
                  <ErrorMessage message={topLevelError} />
                </div>
              ) : null}

              <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
