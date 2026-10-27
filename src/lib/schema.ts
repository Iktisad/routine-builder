import {
  ALL_DAYS,
  ROUTINE_VERSION,
  SLOT_OPTIONS,
  type Activity,
  type DayIndex,
  type Routine,
  type RoutineSettings,
  type SlotMinutes,
} from '../types'
import { addMonthsIso, formatUntil } from './ics'
import { isColorKey } from './palette'
import { MINUTES_IN_DAY, ceilToHour, floorToHour } from './time'

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `a${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function defaultSettings(): RoutineSettings {
  return {
    dayStart: 7 * 60,
    dayEnd: 23 * 60,
    slotMinutes: 30,
    visibleDays: [...ALL_DAYS],
    autoFitHours: true,
    calendarUntil: addMonthsIso(6),
  }
}

export function defaultRoutine(): Routine {
  return {
    version: ROUTINE_VERSION,
    name: 'My routine',
    updatedAt: new Date().toISOString(),
    settings: defaultSettings(),
    activities: [],
  }
}

/** A filled-in week, so the empty grid has a one-click way to show its shape. */
export function sampleRoutine(): Routine {
  const make = (
    title: string,
    days: DayIndex[],
    start: number,
    end: number,
    color: Activity['color'],
    location?: string,
  ): Activity[] =>
    days.map((day) => ({ id: createId(), title, day, start, end, color, location }))

  return {
    ...defaultRoutine(),
    name: 'Sample week',
    activities: [
      ...make('Morning run', [0, 2, 4], 6 * 60 + 30, 7 * 60 + 15, 'lime'),
      ...make('Deep work', [0, 1, 2, 3, 4], 9 * 60, 11 * 60 + 30, 'blue', 'Desk'),
      ...make('Lunch', [0, 1, 2, 3, 4], 12 * 60 + 30, 13 * 60 + 15, 'amber'),
      ...make('Stand-up', [1, 3], 11 * 60 + 45, 12 * 60, 'cyan'),
      ...make('Arabic class', [1, 3], 18 * 60, 19 * 60 + 30, 'violet', 'Room 204'),
      ...make('Gym', [1, 3, 5], 20 * 60, 21 * 60, 'rose'),
      ...make('Family dinner', [5], 19 * 60, 21 * 60, 'orange'),
      ...make('Reading', [6], 10 * 60, 12 * 60, 'teal'),
      ...make('Meal prep', [6], 16 * 60, 17 * 60 + 30, 'teal', 'Kitchen'),
    ],
  }
}

export type ValidationResult =
  | { ok: true; routine: Routine; warnings: string[] }
  | { ok: false; error: string }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isDayIndex = (v: unknown): v is DayIndex =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6

function readSettings(input: unknown, warnings: string[]): RoutineSettings {
  const fallback = defaultSettings()
  if (!isObject(input)) {
    warnings.push('Settings were missing or malformed; defaults applied.')
    return fallback
  }

  // Hours are snapped to whole hours because the hour gridlines and gutter
  // labels are drawn on a fixed hourly period.
  let dayStart = typeof input.dayStart === 'number' ? floorToHour(input.dayStart) : fallback.dayStart
  let dayEnd = typeof input.dayEnd === 'number' ? ceilToHour(input.dayEnd) : fallback.dayEnd
  dayStart = Math.min(Math.max(dayStart, 0), MINUTES_IN_DAY - 60)
  dayEnd = Math.min(Math.max(dayEnd, dayStart + 60), MINUTES_IN_DAY)

  const slotMinutes = (SLOT_OPTIONS as readonly number[]).includes(input.slotMinutes as number)
    ? (input.slotMinutes as SlotMinutes)
    : fallback.slotMinutes

  let visibleDays = Array.isArray(input.visibleDays)
    ? [...new Set(input.visibleDays.filter(isDayIndex))]
    : fallback.visibleDays
  if (visibleDays.length === 0) {
    warnings.push('No visible days in the file; showing the whole week.')
    visibleDays = [...ALL_DAYS]
  }

  // Absent in routines exported before auto-fit existed — they adopt it.
  const autoFitHours = typeof input.autoFitHours === 'boolean' ? input.autoFitHours : true

  // Likewise for the calendar horizon; a malformed date falls back rather than
  // producing an .ics whose events never occur.
  const calendarUntil =
    typeof input.calendarUntil === 'string' && formatUntil(input.calendarUntil)
      ? input.calendarUntil.trim()
      : fallback.calendarUntil

  return { dayStart, dayEnd, slotMinutes, visibleDays, autoFitHours, calendarUntil }
}

function readActivity(input: unknown, seen: Set<string>): Activity | null {
  if (!isObject(input)) return null
  if (typeof input.title !== 'string') return null
  if (!isDayIndex(input.day)) return null

  const start = typeof input.start === 'number' ? Math.round(input.start) : NaN
  const end = typeof input.end === 'number' ? Math.round(input.end) : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start < 0 || end > MINUTES_IN_DAY || start >= end) return null

  // Re-issue ids that are missing or collide, so React keys and drag targets
  // stay unique even if the file was hand-edited.
  let id = typeof input.id === 'string' && input.id.length > 0 ? input.id : createId()
  if (seen.has(id)) id = createId()
  seen.add(id)

  const activity: Activity = {
    id,
    title: input.title.slice(0, 200),
    day: input.day,
    start,
    end,
    color: isColorKey(input.color) ? input.color : 'blue',
  }
  if (typeof input.location === 'string' && input.location.trim()) {
    activity.location = input.location.slice(0, 200)
  }
  if (typeof input.note === 'string' && input.note.trim()) {
    activity.note = input.note.slice(0, 2000)
  }
  return activity
}

/**
 * Parse an imported routine. Structural problems reject outright; individual
 * bad activities are skipped and reported, so one corrupt entry never costs the
 * whole file.
 */
export function validateRoutine(input: unknown): ValidationResult {
  if (!isObject(input)) {
    return { ok: false, error: 'That file does not contain a routine object.' }
  }
  if (input.version !== ROUTINE_VERSION) {
    return {
      ok: false,
      error: `Unsupported routine version ${String(input.version)} — this app reads version ${ROUTINE_VERSION}.`,
    }
  }
  if (!Array.isArray(input.activities)) {
    return { ok: false, error: 'The file is missing its "activities" list.' }
  }

  const warnings: string[] = []
  const settings = readSettings(input.settings, warnings)

  const seen = new Set<string>()
  const activities: Activity[] = []
  let skipped = 0
  for (const raw of input.activities) {
    const activity = readActivity(raw, seen)
    if (activity) activities.push(activity)
    else skipped += 1
  }
  if (skipped > 0) {
    warnings.push(`${skipped} ${skipped === 1 ? 'activity was' : 'activities were'} skipped as invalid.`)
  }

  return {
    ok: true,
    warnings,
    routine: {
      version: ROUTINE_VERSION,
      name: typeof input.name === 'string' && input.name.trim() ? input.name.slice(0, 120) : 'Imported routine',
      updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
      settings,
      activities,
    },
  }
}
