import { MINUTES_IN_DAY, ceilToHour, clampMinutes, floorToHour } from './time'
import type { Activity, RoutineSettings } from '../types'

/** Drag canvas used before anything is scheduled. Never drawn — see `bare`. */
export const CANVAS_FALLBACK = { dayStart: 7 * 60, dayEnd: 23 * 60 }

/** Breathing room above and below the content, so there is room to drag. */
export const PAD_MINUTES = 60

/** Below this the grid stops reading as a calendar, so it is expanded. */
export const MIN_SPAN_MINUTES = 6 * 60

export interface VisibleRange {
  dayStart: number
  dayEnd: number
  /** No activities yet: a usable drag surface with no hour axis drawn. */
  bare: boolean
}

/**
 * The hour window the grid should draw.
 *
 * Every bound returned sits on a whole hour — the gutter labels and the hour
 * gridlines are both drawn on a fixed hourly period, so a half-hour bound would
 * misalign them.
 */
export function visibleRange(
  activities: Activity[],
  settings: RoutineSettings,
): VisibleRange {
  // Explicit opt-out wins: the user set the hours by hand.
  if (settings.autoFitHours === false) {
    return { dayStart: settings.dayStart, dayEnd: settings.dayEnd, bare: false }
  }

  if (activities.length === 0) {
    return { ...CANVAS_FALLBACK, bare: true }
  }

  let earliest = Number.POSITIVE_INFINITY
  let latest = Number.NEGATIVE_INFINITY
  for (const activity of activities) {
    if (activity.start < earliest) earliest = activity.start
    if (activity.end > latest) latest = activity.end
  }

  let dayStart = clampMinutes(floorToHour(earliest) - PAD_MINUTES, 0, MINUTES_IN_DAY)
  let dayEnd = clampMinutes(ceilToHour(latest) + PAD_MINUTES, 0, MINUTES_IN_DAY)

  if (dayEnd - dayStart < MIN_SPAN_MINUTES) {
    // Grow upward first, in whole hours, then clamp — shifting the window
    // rather than letting it run past midnight at either end.
    const deficit = MIN_SPAN_MINUTES - (dayEnd - dayStart)
    dayStart = Math.max(0, dayStart - ceilToHour(deficit / 2))
    dayEnd = Math.min(MINUTES_IN_DAY, dayStart + MIN_SPAN_MINUTES)
    if (dayEnd - dayStart < MIN_SPAN_MINUTES) {
      dayStart = Math.max(0, dayEnd - MIN_SPAN_MINUTES)
    }
  }

  return { dayStart, dayEnd, bare: false }
}
