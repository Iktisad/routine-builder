import type { VisibleRange } from './range'
import type { Activity, DayIndex } from '../types'

/** A run of empty time at least this long shrinks to a marked band. */
export const GAP_THRESHOLD = 120

/** Height a collapsed gap gets, in hour units — room for its duration label. */
export const COLLAPSED_UNITS = 0.6

/** Two labels closer than this (in hour units) would collide; drop the later. */
export const TICK_MIN_UNITS = 0.4

export interface AxisSegment {
  start: number
  end: number
  collapsed: boolean
  /** Height in hour units. A normal segment is worth its real duration. */
  units: number
  /** Cumulative units before this segment starts. */
  offset: number
}

export interface AxisGap {
  /** Fraction of the column height. */
  top: number
  height: number
  /** Real minutes hidden inside the band. */
  minutes: number
}

export interface Axis {
  segments: AxisSegment[]
  /** Drives `--span-hours`, so the existing print scaling keeps working. */
  totalUnits: number
  /** Minutes worth drawing a rule and a label for. */
  ticks: number[]
  gaps: AxisGap[]
  rangeStart: number
  rangeEnd: number
}

/** Merge overlapping/touching intervals, clamped to the window. */
function occupancy(activities: Activity[], start: number, end: number): [number, number][] {
  const spans = activities
    .map((a): [number, number] => [Math.max(a.start, start), Math.min(a.end, end)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])

  const merged: [number, number][] = []
  for (const [s, e] of spans) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  return merged
}

/**
 * Build the vertical time axis.
 *
 * Time is no longer uniform: long empty stretches collapse to a fixed short
 * band. Everything that maps a minute to a position must go through
 * `projectMinute`, and anything mapping a position back to a minute (drag,
 * resize, create) must go through `unprojectFraction`.
 *
 * Occupancy is the union across *every visible day* — the axis is shared by all
 * seven columns, so a gap only exists where nothing is scheduled on any of them.
 */
export function buildAxis(
  activities: Activity[],
  range: VisibleRange,
  visibleDays?: readonly DayIndex[],
): Axis {
  const { dayStart: rangeStart, dayEnd: rangeEnd } = range
  const span = rangeEnd - rangeStart

  const base: Axis = {
    segments: [{ start: rangeStart, end: rangeEnd, collapsed: false, units: Math.max(span, 0) / 60, offset: 0 }],
    totalUnits: Math.max(span, 0) / 60,
    ticks: [],
    gaps: [],
    rangeStart,
    rangeEnd,
  }
  if (span <= 0) return { ...base, totalUnits: 0, segments: [] }

  const relevant = visibleDays
    ? activities.filter((a) => visibleDays.includes(a.day))
    : activities
  const busy = occupancy(relevant, rangeStart, rangeEnd)
  // Nothing scheduled: one uniform segment, so projection stays linear.
  if (busy.length === 0) return base

  // Walk the window, turning each long empty run into a collapsed segment.
  const raw: Omit<AxisSegment, 'offset'>[] = []
  const push = (start: number, end: number, collapsed: boolean) => {
    if (end <= start) return
    raw.push({ start, end, collapsed, units: collapsed ? COLLAPSED_UNITS : (end - start) / 60 })
  }

  let cursor = rangeStart
  for (const [s, e] of busy) {
    if (s > cursor) push(cursor, s, s - cursor >= GAP_THRESHOLD)
    push(s, e, false)
    cursor = e
  }
  if (rangeEnd > cursor) push(cursor, rangeEnd, rangeEnd - cursor >= GAP_THRESHOLD)

  // Fold neighbouring uncollapsed runs together — fewer segments, same maths.
  const folded: Omit<AxisSegment, 'offset'>[] = []
  for (const seg of raw) {
    const last = folded[folded.length - 1]
    if (last && !last.collapsed && !seg.collapsed && last.end === seg.start) {
      last.end = seg.end
      last.units = (last.end - last.start) / 60
    } else {
      folded.push({ ...seg })
    }
  }

  let offset = 0
  const segments: AxisSegment[] = folded.map((seg) => {
    const placed = { ...seg, offset }
    offset += seg.units
    return placed
  })
  const totalUnits = offset

  const axis: Axis = { segments, totalUnits, ticks: [], gaps: [], rangeStart, rangeEnd }

  axis.gaps = segments
    .filter((seg) => seg.collapsed)
    .map((seg) => ({
      top: seg.offset / totalUnits,
      height: seg.units / totalUnits,
      minutes: seg.end - seg.start,
    }))

  // Label only the moments something actually starts or ends, dropping any that
  // would land on top of the previous one.
  const boundaries = [...new Set(relevant.flatMap((a) => [a.start, a.end]))]
    .filter((m) => m >= rangeStart && m <= rangeEnd)
    .sort((a, b) => a - b)

  let lastUnits = Number.NEGATIVE_INFINITY
  for (const minute of boundaries) {
    const units = projectMinute(axis, minute) * totalUnits
    if (units - lastUnits < TICK_MIN_UNITS) continue
    axis.ticks.push(minute)
    lastUnits = units
  }

  return axis
}

function segmentFor(axis: Axis, minute: number): AxisSegment | undefined {
  const { segments } = axis
  for (const seg of segments) if (minute <= seg.end) return seg
  return segments[segments.length - 1]
}

/** Minute → fraction of the column height. */
export function projectMinute(axis: Axis, minute: number): number {
  if (axis.totalUnits <= 0) return 0
  const clamped = Math.min(axis.rangeEnd, Math.max(axis.rangeStart, minute))
  const seg = segmentFor(axis, clamped)
  if (!seg) return 0
  const duration = seg.end - seg.start
  const within = duration > 0 ? ((clamped - seg.start) / duration) * seg.units : 0
  return (seg.offset + within) / axis.totalUnits
}

/** Fraction of the column height → minute. The inverse of `projectMinute`. */
export function unprojectFraction(axis: Axis, fraction: number): number {
  if (axis.totalUnits <= 0) return axis.rangeStart
  const target = Math.min(axis.totalUnits, Math.max(0, fraction * axis.totalUnits))
  const seg =
    axis.segments.find((s) => target <= s.offset + s.units) ??
    axis.segments[axis.segments.length - 1]
  if (!seg) return axis.rangeStart
  if (seg.units <= 0) return seg.start
  return seg.start + ((target - seg.offset) / seg.units) * (seg.end - seg.start)
}
