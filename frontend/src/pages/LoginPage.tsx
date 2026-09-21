import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ErrorMessage } from '../components/common/ErrorMessage'
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
    <main className="auth-page">
      <section aria-labelledby="login-heading" className="auth-card">
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
            <input
              id={passwordInputId}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
              aria-invalid={fieldErrors.password ? true : undefined}
            />
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

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
