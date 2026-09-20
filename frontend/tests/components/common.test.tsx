import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorMessage } from '../../src/components/common/ErrorMessage'
import { LoadingIndicator } from '../../src/components/common/LoadingIndicator'

describe('LoadingIndicator', () => {
  it('announces loading state via a status role', () => {
    render(<LoadingIndicator label="Loading employees…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading employees…')
  })
})

describe('ErrorMessage', () => {
  it('announces the error message via an alert role', () => {
    render(<ErrorMessage message="Unable to load employees." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load employees.')
  })

  it('invokes onRetry when the retry button is activated by keyboard', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorMessage message="Unable to load employees." onRetry={onRetry} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onRetry).toHaveBeenCalledOnce()
  })
})
