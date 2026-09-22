import { useEffect, useState } from 'react'

export interface BarListItem {
  label: string
  value: number
  displayValue: string
}

interface BarListProps {
  title: string
  items: BarListItem[]
  emptyMessage?: string
  /** How many of `items` (already sorted by the caller) to actually draw as bars. */
  maxBars?: number
}

/**
 * A minimal horizontal bar-list visualization: one hue (the brand primary),
 * length encodes magnitude, value labeled at the tip — a supplementary,
 * at-a-glance read of data that's already fully represented in an adjacent
 * accessible table, so this chart is `aria-hidden` rather than duplicating
 * that table's content for assistive tech.
 */
export function BarList({ title, items, emptyMessage = 'No data available.', maxBars = 8 }: BarListProps) {
  const shown = items.slice(0, maxBars)
  const maxValue = Math.max(1, ...shown.map((item) => item.value))
  const hiddenCount = items.length - shown.length

  // Bars grow in from zero on mount/update, rather than snapping straight to
  // their final width — `isGrown` starts false so the first paint has every
  // fill at 0%, then flips true on the next frame so the CSS `width`
  // transition (see `.bar-chart__fill`) actually has something to animate.
  const [isGrown, setIsGrown] = useState(false)
  useEffect(() => {
    setIsGrown(false)
    const frame = requestAnimationFrame(() => setIsGrown(true))
    return () => cancelAnimationFrame(frame)
  }, [items])

  return (
    <div className="bar-chart card card-padded" aria-hidden="true">
      <h3 className="bar-chart__title">{title}</h3>
      {shown.length === 0 ? (
        <p className="bar-chart__empty">{emptyMessage}</p>
      ) : (
        <>
          <div className="bar-chart__rows">
            {shown.map((item) => (
              <div className="bar-chart__row" key={item.label} title={`${item.label}: ${item.displayValue}`}>
                <span className="bar-chart__label">{item.label}</span>
                <div className="bar-chart__track">
                  <div
                    className="bar-chart__fill"
                    style={{ width: isGrown ? `${(item.value / maxValue) * 100}%` : '0%' }}
                  />
                </div>
                <span className="bar-chart__value">{item.displayValue}</span>
              </div>
            ))}
          </div>
          {hiddenCount > 0 ? (
            <p className="bar-chart__note">+{hiddenCount} more — see the full breakdown in the table below.</p>
          ) : null}
        </>
      )}
    </div>
  )
}
