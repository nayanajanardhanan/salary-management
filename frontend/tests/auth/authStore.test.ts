import { beforeEach, describe, expect, it } from 'vitest'
import {
  expireSession,
  getSessionExpired,
  getToken,
  logout,
  setToken,
  subscribeToToken,
} from '../../src/auth/authStore'

describe('authStore', () => {
  beforeEach(() => {
    logout()
  })

  it('starts unauthenticated with no token — nothing hardcoded to sign the user in', () => {
    expect(getToken()).toBeNull()
    expect(getSessionExpired()).toBe(false)
  })

  it('stores a user-supplied token and persists it to sessionStorage', () => {
    setToken('user-supplied-token')

    expect(getToken()).toBe('user-supplied-token')
    expect(sessionStorage.getItem('payscope.authToken')).toBe('user-supplied-token')
  })

  it('clears the token and any session-expired flag on explicit logout', () => {
    setToken('user-supplied-token')
    expireSession()

    logout()

    expect(getToken()).toBeNull()
    expect(getSessionExpired()).toBe(false)
  })

  it('clears the token and flags the session as expired on expireSession', () => {
    setToken('user-supplied-token')

    expireSession()

    expect(getToken()).toBeNull()
    expect(getSessionExpired()).toBe(true)
  })

  it('clears the session-expired flag once a new token is set', () => {
    setToken('user-supplied-token')
    expireSession()

    setToken('another-token')

    expect(getSessionExpired()).toBe(false)
  })

  it('notifies subscribers whenever the token changes', () => {
    let notifications = 0
    const unsubscribe = subscribeToToken(() => {
      notifications += 1
    })

    setToken('user-supplied-token')
    expireSession()
    unsubscribe()
    logout()

    expect(notifications).toBe(2)
  })
})
