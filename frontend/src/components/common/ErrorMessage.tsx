interface ErrorMessageProps {
  message: string
  onRetry?: () => void
}

/**
 * User-readable error state, announced via `role="alert"`. Never renders raw
 * technical detail (stack traces, backend internals) — only the normalized
 * message an `ApiError` (see `api/client.ts`) or similar carries.
 */
export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="error-message" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}
