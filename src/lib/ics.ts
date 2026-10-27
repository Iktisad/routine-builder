import type { DayIndex, Routine } from '../types'

const PRODID = '-//Routine Builder//Routine//EN'

/** RFC 5545 weekday codes, indexed to match DayIndex (0 = Sunday). */
export const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/** Arbitrary fixed point for deriving a monotonic SEQUENCE. */
const SEQUENCE_EPOCH = Date.UTC(2026, 0, 1)

const encoder = new TextEncoder()
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Escape a text value per RFC 5545 §3.3.11. Backslashes go first — escaping
 * them after the others would double-escape the backslashes we just added.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Fold a content line to 75 octets, continuations prefixed with one space.
 * Counts UTF-8 bytes rather than characters, and never splits a code point —
 * a title with an emoji or an accent would otherwise produce a corrupt file.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line

  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // Continuation lines spend one octet on their leading space.
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join('\r\n')
}

/** Floating local time: no Z, no TZID, so 9am stays 9am wherever you are. */
function formatLocal(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

/** DTSTAMP is a genuine UTC instant, unlike the floating event times. */
function formatUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/**
 * RFC 5545: when DTSTART is floating, UNTIL must be floating too. A
 * Z-suffixed UNTIL against a floating start is invalid and clients mangle it.
 */
export function formatUntil(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!match) return null
  const [, y, m, d] = match
  const probe = new Date(Number(y), Number(m) - 1, Number(d))
  if (probe.getMonth() !== Number(m) - 1 || probe.getDate() !== Number(d)) return null
  return `${y}${m}${d}T235959`
}

/** The date of `day` within the current week, Sunday-first to match the grid. */
export function occurrenceDate(day: DayIndex, minutes: number, now: Date): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  date.setDate(date.getDate() - date.getDay() + day)
  date.setHours(0, 0, 0, 0)
  // setMinutes rolls past midnight for us, which is what an end of 1440 wants.
  date.setMinutes(minutes)
  return date
}

/**
 * Whole minutes since a fixed epoch. Monotonic and needs no stored counter:
 * it rises whenever the routine is edited, which is the signal a calendar
 * needs before it will accept a revision to an event it already holds.
 */
export function sequenceFor(updatedAt: string): number {
  const parsed = Date.parse(updatedAt)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor((parsed - SEQUENCE_EPOCH) / 60000))
}

/** ISO YYYY-MM-DD `months` from `from`, for the horizon presets. */
export function addMonthsIso(months: number, from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  date.setMonth(date.getMonth() + months)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** True when the horizon has already passed, so the file would hold no events. */
export function isUntilInPast(isoDate: string, now = new Date()): boolean {
  const formatted = formatUntil(isoDate)
  if (!formatted) return false
  return isoDate.trim() < toIsoDate(now)
}

/**
 * Build an iCalendar document: one weekly-recurring VEVENT per activity.
 *
 * The UID is derived from the activity's id, which already lives in the saved
 * JSON and never changes. That is what makes re-importing an edited routine
 * revise the existing events rather than duplicate them. Deleting an activity
 * is deliberately NOT represented here — a file import can add and revise but
 * never retract, so removals stay the user's job in their calendar app.
 */
export function buildCalendar(routine: Routine, options: { now?: Date } = {}): string {
  const now = options.now ?? new Date()
  const until = formatUntil(routine.settings.calendarUntil)
  const sequence = sequenceFor(routine.updatedAt)
  const stamp = formatUtc(now)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(routine.name)}`,
  ]

  for (const activity of routine.activities) {
    const rrule = ['FREQ=WEEKLY', `BYDAY=${DAY_CODES[activity.day]}`]
    if (until) rrule.push(`UNTIL=${until}`)

    lines.push(
      'BEGIN:VEVENT',
      `UID:${activity.id}@routine-builder`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${sequence}`,
      `DTSTART:${formatLocal(occurrenceDate(activity.day, activity.start, now))}`,
      `DTEND:${formatLocal(occurrenceDate(activity.day, activity.end, now))}`,
      `RRULE:${rrule.join(';')}`,
      `SUMMARY:${escapeText(activity.title)}`,
    )
    if (activity.location) lines.push(`LOCATION:${escapeText(activity.location)}`)
    if (activity.note) lines.push(`DESCRIPTION:${escapeText(activity.note)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  // CRLF throughout, including a trailing one, as the spec requires.
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
