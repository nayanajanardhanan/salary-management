import { useCallback, useState } from 'react'
import { login as loginRequest } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'

export interface UseLoginResult {
  /** True while the login request is in flight — disable the submit button on this, not just track it manually. */
  isSubmitting: boolean
  /** A failure to show the user: invalid credentials, a network failure, or an unexpected error. */
  formError: string | null
  /** Submits credentials; returns `true` only once the backend has confirmed them. */
  submit: (usernameOrEmail: string, password: string) => Promise<boolean>
}

const INVALID_CREDENTIALS_MESSAGE = 'Incorrect username/email or password.'
const GENERIC_ERROR_MESSAGE = 'Something went wrong while signing in. Please try again.'

/**
 * Encapsulates submission state for the login form (`pages/LoginPage.tsx`),
 * mirroring this codebase's other one-shot-mutation hooks (e.g.
 * `useCreateEmployee`): `isSubmitting`/`formError` plus a `submit` the form
 * calls directly, no `cancelled`-flag guard needed since nothing else
 * re-triggers it.
 *
 * On success, calls the shared `useAuth().login`
 * (`../auth/AuthContext.tsx`) with the returned access token — the same
 * authentication state every protected route/request already reads
 * (`../auth/authStore.ts`), so this hook never introduces a second,
 * competing notion of "logged in". `submit` only ever resolves `true` after
 * that call, i.e. after the backend has actually confirmed the
 * credentials — never optimistically before the response arrives.
 */
export function useLogin(): UseLoginResult {
  const { login } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = useCallback(
    async (usernameOrEmail: string, password: string): Promise<boolean> => {
      setIsSubmitting(true)
      setFormError(null)

      try {
        const response = await loginRequest({ username_or_email: usernameOrEmail, password })
        login(response.access_token)
        return true
      } catch (err) {
        if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
          setFormError(INVALID_CREDENTIALS_MESSAGE)
        } else {
          setFormError(err instanceof ApiError ? err.message : GENERIC_ERROR_MESSAGE)
        }
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [login],
  )

  return { isSubmitting, formError, submit }
}
