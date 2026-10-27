import type { Axis } from '../lib/axis'
import { projectMinute } from '../lib/axis'
import { formatTime } from '../lib/time'

interface Props {
  axis: Axis
  /** Nothing scheduled yet — the axis is not drawn at all. */
  bare: boolean
}

/**
 * Labels only the moments something starts or ends, rather than every hour.
 * The axis has already dropped any boundary that would collide with its
 * neighbour, so these can be rendered straight out.
 */
export default function TimeGutter({ axis, bare }: Props) {
  if (bare || axis.ticks.length === 0) return <div className="time-gutter" />

  return (
    <div className="time-gutter">
      {axis.ticks.map((minute, index) => (
        <span
          key={minute}
          className="time-label"
          data-first={index === 0}
          data-last={index === axis.ticks.length - 1}
          style={{ top: `${projectMinute(axis, minute) * 100}%` }}
        >
          {formatTime(minute)}
        </span>
      ))}
    </div>
  )
}
