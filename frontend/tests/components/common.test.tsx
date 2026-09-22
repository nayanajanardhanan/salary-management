import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog'
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

/** A trigger button plus the dialog, matching how every caller uses `ConfirmDialog`: opened from a button, closed back to it. */
function ConfirmDialogHarness({
  isConfirming = false,
  error = null,
  onConfirm,
}: {
  isConfirming?: boolean
  error?: string | null
  onConfirm: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Delete salary
      </button>
      <ConfirmDialog
        isOpen={isOpen}
        title="Delete salary record?"
        description="This will permanently remove the current salary record. This action cannot be undone."
        confirmLabel="Delete salary"
        confirmingLabel="Deleting…"
        isConfirming={isConfirming}
        error={error}
        onConfirm={onConfirm}
        onCancel={() => setIsOpen(false)}
      />
    </div>
  )
}

describe('ConfirmDialog', () => {
  it('renders nothing until opened', () => {
    render(<ConfirmDialogHarness onConfirm={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as an accessible, labelled, described modal dialog and moves focus into it', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialogHarness onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete salary record?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent(/permanently remove the current salary record/i)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('calls onCancel, without calling onConfirm, when Cancel is activated', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDialogHarness onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('returns focus to the triggering button after Cancel closes the dialog', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialogHarness onConfirm={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'Delete salary' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(trigger).toHaveFocus()
  })

  it('closes via the Escape key without calling onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDialogHarness onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('ignores the Escape key while a confirm request is in progress', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialogHarness onConfirm={vi.fn()} isConfirming />)

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onConfirm when the destructive action is activated', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDialogHarness onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))
    // Two "Delete salary" controls exist once open: the (now-hidden-behind-dialog) trigger and the dialog's own confirm button.
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete salary' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('disables both actions and shows the confirming label while a request is in progress', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialogHarness onConfirm={vi.fn()} isConfirming />)

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Deleting…' })).toBeDisabled()
  })

  it('traps Tab focus between Cancel and the destructive action', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialogHarness onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))
    const dialog = screen.getByRole('dialog')
    const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' })
    const confirmButton = within(dialog).getByRole('button', { name: 'Delete salary' })

    expect(cancelButton).toHaveFocus()
    await user.tab()
    expect(confirmButton).toHaveFocus()
    await user.tab()
    expect(cancelButton).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirmButton).toHaveFocus()
  })

  it('shows a confirm-attempt error inside the dialog', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialogHarness onConfirm={vi.fn()} error="Something went wrong. Please try again." />)

    await user.click(screen.getByRole('button', { name: 'Delete salary' }))

    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })
})
