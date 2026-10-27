/** 0 = Sunday … 6 = Saturday. The grid always renders Sunday-first. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const ALL_DAYS: readonly DayIndex[] = [0, 1, 2, 3, 4, 5, 6]

export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Eight categorical hues, spaced around the wheel. Values live in index.css. */
export const COLOR_KEYS = [
  'blue', 'violet', 'rose', 'orange', 'amber', 'lime', 'teal', 'cyan',
] as const
export type ColorKey = (typeof COLOR_KEYS)[number]

export const SLOT_OPTIONS = [15, 30, 60] as const
export type SlotMinutes = (typeof SLOT_OPTIONS)[number]

export interface Activity {
  id: string
  title: string
  day: DayIndex
  /** Minutes from midnight, e.g. 555 = 09:15. */
  start: number
  /** Minutes from midnight, exclusive. Always > start. */
  end: number
  color: ColorKey
  location?: string
  note?: string
}

export interface RoutineSettings {
  /** Top of the grid, in minutes from midnight. Snapped to a whole hour. */
  dayStart: number
  /** Bottom of the grid, in minutes from midnight. Snapped to a whole hour. */
  dayEnd: number
  /** Gridline density, and the increment that drags snap to. */
  slotMinutes: SlotMinutes
  /** Which day columns to show. Rendered in 0→6 order regardless of this array's order. */
  visibleDays: DayIndex[]
  /**
   * When true (the default) the hour window follows the activities instead of
   * dayStart/dayEnd, and an empty routine draws no hour axis at all.
   */
  autoFitHours: boolean
  /** ISO YYYY-MM-DD the weekly calendar repeat stops on. */
  calendarUntil: string
}

export interface Routine {
  version: typeof ROUTINE_VERSION
  name: string
  /** ISO timestamp of the last edit. */
  updatedAt: string
  settings: RoutineSettings
  activities: Activity[]
}

/** Bumped only if the serialised shape changes; import refuses other versions. */
export const ROUTINE_VERSION = 1
