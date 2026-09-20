import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

interface LocationState {
  from?: string
}

export function LoginPage() {
  useDocumentTitle('Sign in - PayScope')

  const { isAuthenticated, sessionExpired, login } = useAuth()
  const location = useLocation()
  const [tokenInput, setTokenInput] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  if (isAuthenticated) {
    const redirectTo = (location.state as LocationState | null)?.from ?? '/'
    return <Navigate to={redirectTo} replace />
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const trimmed = tokenInput.trim()
    if (!trimmed) {
      setValidationError('Enter your access token.')
      return
    }
    setValidationError(null)
    login(trimmed)
  }

  const errorMessage =
    validationError ??
    (sessionExpired
      ? 'Your session has expired or the access token is no longer valid. Please sign in again.'
      : null)

  return (
    <main className="auth-page">
      <section aria-labelledby="login-heading" className="auth-card">
        <h1 id="login-heading">Sign in to PayScope</h1>
        <p>Enter the access token issued for the PayScope API.</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor={inputId}>Access token</label>
            <input
              id={inputId}
              name="token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              aria-describedby={errorMessage ? errorId : undefined}
              aria-invalid={errorMessage ? true : undefined}
            />
          </div>
          {errorMessage ? (
            <div id={errorId}>
              <ErrorMessage message={errorMessage} />
            </div>
          ) : null}
          <button type="submit">Sign in</button>
        </form>
      </section>
    </main>
  )
}
