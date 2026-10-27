import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { MAX_INSET_DEPTH, type PositionedActivity } from '../lib/layout'
import { colorStyle } from '../lib/palette'
import { formatDuration, formatRange } from '../lib/time'
import type { Activity } from '../types'

export type DragMode = 'move' | 'resize'

interface Props {
  positioned: PositionedActivity
  dragging: boolean
  onPointerDown: (activity: Activity, mode: DragMode, event: PointerEvent<HTMLElement>) => void
  onKeyDown: (activity: Activity, event: KeyboardEvent<HTMLElement>) => void
}

export default function ActivityBlock({ positioned, dragging, onPointerDown, onKeyDown }: Props) {
  const { activity, top, height, depth, clippedStart, clippedEnd } = positioned
  const range = formatRange(activity.start, activity.end)
  const duration = formatDuration(activity.end - activity.start)

  // Inset in pixels rather than a fraction, so nesting looks the same in a
  // narrow column as a wide one. The inset stops deepening past the cap; the
  // stacking order keeps climbing so the newest card still lands on top.
  const slotStyle = {
    top: `${top * 100}%`,
    height: `${height * 100}%`,
    '--depth': Math.min(depth, MAX_INSET_DEPTH),
    zIndex: depth + 1,
  } as CSSProperties

  const details = [range, duration, activity.location, activity.note]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="block-slot" style={slotStyle}>
      <button
        type="button"
        className="activity-block"
        data-dragging={dragging}
        style={colorStyle(activity.color)}
        title={`${activity.title}\n${details}`}
        aria-label={`${activity.title}, ${range}${activity.location ? `, ${activity.location}` : ''}. Press Enter to edit, arrow keys to move.`}
        onPointerDown={(event) => onPointerDown(activity, 'move', event)}
        onKeyDown={(event) => onKeyDown(activity, event)}
      >
        <div className="activity-title">
          {clippedStart ? '↑ ' : ''}
          {activity.title}
          {clippedEnd ? ' ↓' : ''}
        </div>
        <div className="activity-meta">{range}</div>
        {activity.location ? <div className="activity-meta activity-place">{activity.location}</div> : null}
      </button>
      <div
        className="resize-handle no-print"
        role="presentation"
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown(activity, 'resize', event)
        }}
      />
    </div>
  )
}
