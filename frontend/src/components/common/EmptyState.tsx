interface EmptyStateProps {
  message: string
}

/** Accessible "no results" state, distinct from `ErrorMessage` (a valid empty result, not a failure). */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <p>{message}</p>
    </div>
  )
}
