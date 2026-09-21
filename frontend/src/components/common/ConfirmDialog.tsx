import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { ErrorMessage } from './ErrorMessage'
import { AlertCircleIcon } from './icons'

interface ConfirmDialogProps {
  /** Whether the dialog is currently shown. The component always renders (returning `null` when closed) so its focus-management effect can run on every open/close transition. */
  isOpen: boolean
  title: string
  /** The dialog's accessible description — plain explanatory text, not the whole body. */
  description: ReactNode
  confirmLabel: string
  /** Shown on the confirm button in place of `confirmLabel` while `isConfirming` is true. */
  confirmingLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  /** True while the confirmed action's request is in flight — disables both buttons and blocks the Escape key, so a request already underway can't be duplicated or abandoned mid-flight. */
  isConfirming: boolean
  /** A failure from the last confirm attempt, shown inside the dialog so the user can retry without losing context. */
  error?: string | null
}

/**
 * A generic, keyboard-accessible confirmation dialog for a destructive or
 * otherwise consequential action — first used by salary deletion
 * (`pages/EmployeeDetailsPage.tsx`), written generically since any future
 * confirm-before-you-act flow can reuse it instead of hand-rolling another
 * one. Not built on the native `<dialog>` element: this codebase's test
 * environment (jsdom) doesn't implement `HTMLDialogElement.showModal`, and a
 * plain `role="dialog"` element with manual focus handling is both simpler
 * to test and fully sufficient for a single, non-nested modal.
 *
 * Focus handling: moves focus to the Cancel button when it opens, restores
 * focus to whatever was focused right before it opened (the triggering
 * button, in every current use) when it closes, traps Tab/Shift+Tab within
 * the dialog's own buttons, and treats Escape as Cancel — unless
 * `isConfirming`, so a request already in flight can't be abandoned
 * mid-air by a stray keypress.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmingLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isConfirming,
  error = null,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previouslyFocused = document.activeElement as HTMLElement | null
    cancelButtonRef.current?.focus()

    return () => {
      previouslyFocused?.focus()
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      if (!isConfirming) {
        event.stopPropagation()
        onCancel()
      }
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const first = cancelButtonRef.current
    const last = confirmButtonRef.current
    if (!first || !last) {
      return
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="confirm-dialog-overlay">
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        <span className="confirm-dialog__icon" aria-hidden="true">
          <AlertCircleIcon width={20} height={20} />
        </span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>

        {error ? <ErrorMessage message={error} /> : null}

        <div className="confirm-dialog__actions">
          <button type="button" ref={cancelButtonRef} onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmButtonRef}
            className="confirm-dialog__danger-button"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                {confirmingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
