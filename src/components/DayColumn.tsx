import type { KeyboardEvent, PointerEvent } from 'react'
import type { Axis } from '../lib/axis'
import { projectMinute } from '../lib/axis'
import type { PositionedActivity } from '../lib/layout'
import { formatDuration } from '../lib/time'
import type { Activity, DayIndex } from '../types'
import ActivityBlock, { type DragMode } from './ActivityBlock'

interface Props {
  day: DayIndex
  /** Nothing scheduled yet — draw no rules or bands. */
  bare: boolean
  axis: Axis
  /** Fraction of the column height for the "now" marker, or null. */
  nowFraction: number | null
  positioned: PositionedActivity[]
  /** Live ghost while dragging out a new activity, as height fractions. */
  preview: { top: number; height: number } | null
  draggingId: string | null
  registerRef: (day: DayIndex, element: HTMLDivElement | null) => void
  onBackgroundPointerDown: (day: DayIndex, event: PointerEvent<HTMLDivElement>) => void
  onBlockPointerDown: (activity: Activity, mode: DragMode, event: PointerEvent<HTMLElement>) => void
  onBlockKeyDown: (activity: Activity, event: KeyboardEvent<HTMLElement>) => void
}

export default function DayColumn({
  day,
  bare,
  axis,
  nowFraction,
  positioned,
  preview,
  draggingId,
  registerRef,
  onBackgroundPointerDown,
  onBlockPointerDown,
  onBlockKeyDown,
}: Props) {
  return (
    <div
      ref={(element) => registerRef(day, element)}
      className="day-column"
      data-weekend={day === 5 || day === 6}
      data-bare={bare}
      onPointerDown={(event) => onBackgroundPointerDown(day, event)}
    >
      {/* Rules sit only at labelled boundaries — the axis is not uniform, so a
          repeating gradient can no longer draw them. */}
      {bare
        ? null
        : axis.ticks.map((minute) => (
            <div
              key={`tick-${minute}`}
              className="tick-line"
              style={{ top: `${projectMinute(axis, minute) * 100}%` }}
              aria-hidden="true"
            />
          ))}

      {bare
        ? null
        : axis.gaps.map((gap) => (
            <div
              key={`gap-${gap.top}`}
              className="gap-band"
              style={{ top: `${gap.top * 100}%`, height: `${gap.height * 100}%` }}
              aria-hidden="true"
            >
              {day === 0 ? <span className="gap-label">{formatDuration(gap.minutes)}</span> : null}
            </div>
          ))}

      {nowFraction !== null ? (
        <div className="now-line" style={{ top: `${nowFraction * 100}%` }} aria-hidden="true" />
      ) : null}

      {positioned.map((item) => (
        <ActivityBlock
          key={item.activity.id}
          positioned={item}
          dragging={draggingId === item.activity.id}
          onPointerDown={onBlockPointerDown}
          onKeyDown={onBlockKeyDown}
        />
      ))}

      {preview ? (
        <div
          className="create-preview"
          style={{ top: `${preview.top * 100}%`, height: `${preview.height * 100}%`, left: 0, right: '3px' }}
        />
      ) : null}
    </div>
  )
}
