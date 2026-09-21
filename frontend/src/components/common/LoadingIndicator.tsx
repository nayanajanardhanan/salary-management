import type { ReactNode } from 'react'

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

interface LoadingRegionProps {
  label: string
  children: ReactNode
}

/**
 * Wraps a skeleton placeholder in an accessible `role="status"` region: the
 * `label` is announced to assistive tech (visually hidden), while `children`
 * (a skeleton layout) gives sighted users a preview of the content shape
 * instead of a blank area or a lone spinner.
 */
export function LoadingRegion({ label, children }: LoadingRegionProps) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
  columns?: number
}

/** Skeleton placeholder for a table region while its first page of data loads. */
export function SkeletonTable({ rows = 6, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="skeleton-table__row" key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <span className="skeleton skeleton-table__cell" key={colIndex} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Skeleton placeholder for the toolbar (search/filters) above a data table. */
export function SkeletonToolbar() {
  return <div className="skeleton skeleton-toolbar" aria-hidden="true" />
}

interface SkeletonCardsProps {
  count?: number
}

/** Skeleton placeholder for a grid of stat cards while analytics loads. */
export function SkeletonCards({ count = 3 }: SkeletonCardsProps) {
  return (
    <div className="skeleton-cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span className="skeleton skeleton-card" key={index} />
      ))}
    </div>
  )
}
