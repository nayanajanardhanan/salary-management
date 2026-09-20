interface LoadingIndicatorProps {
  label?: string
}

/** Accessible loading state, announced to assistive tech via `role="status"`. */
export function LoadingIndicator({ label = 'Loading…' }: LoadingIndicatorProps) {
  return (
    <div className="loading-indicator" role="status" aria-live="polite">
      <span className="loading-indicator__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
