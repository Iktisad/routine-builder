import { projectMinute, type Axis } from './axis'
import type { Activity } from '../types'

/** Past this, deeper cards stop insetting further — only the stacking climbs. */
export const MAX_INSET_DEPTH = 4

export interface PositionedActivity {
  activity: Activity
  /** Fraction of the column height; 0 is the top of the window. */
  top: number
  height: number
  /** How many activities this one is nested inside. 0 = full width. */
  depth: number
  /** Extends above the visible window. */
  clippedStart: boolean
  /** Extends below the visible window. */
  clippedEnd: boolean
}

/** True when any part of the activity falls inside the visible hours. */
export function intersectsWindow(activity: Activity, dayStart: number, dayEnd: number): boolean {
  return activity.end > dayStart && activity.start < dayEnd
}

/**
 * Position one day's activities.
 *
 * Overlapping activities nest rather than sharing the width: each one that
 * starts while another is still running is drawn inset on both sides and on
 * top, so a clash reads as one card lying across another.
 *
 * Vertical positions come from the axis, which is piecewise — long empty
 * stretches are collapsed, so a minute is not a fixed number of pixels.
 */
export function layoutDay(activities: Activity[], axis: Axis): PositionedActivity[] {
  const { rangeStart, rangeEnd } = axis
  if (rangeEnd <= rangeStart) return []

  // Earliest first; on a tie the longer activity leads, so an enclosing block
  // is placed before the ones nested inside it.
  const sorted = activities
    .filter((a) => intersectsWindow(a, rangeStart, rangeEnd))
    .sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id))

  // A stack of activities still open at the current point in time; its height
  // is how deeply the next activity is nested.
  const open: Activity[] = []

  return sorted.map((activity) => {
    // Sweep the whole stack, not just its top: activities do not finish in
    // the order they started, so an earlier one can end while a later one runs.
    for (let i = open.length - 1; i >= 0; i -= 1) {
      if (open[i].end <= activity.start) open.splice(i, 1)
    }
    const depth = open.length
    open.push(activity)

    return {
      activity,
      top: projectMinute(axis, activity.start),
      height: projectMinute(axis, activity.end) - projectMinute(axis, activity.start),
      depth,
      clippedStart: activity.start < rangeStart,
      clippedEnd: activity.end > rangeEnd,
    }
  })
}
