/** Below this a 30-minute card stops being legible, so the grid scrolls instead. */
export const MIN_HOUR_PX = 26

/** Used until the container has actually been measured. */
export const DEFAULT_HOUR_PX = 56

export interface FitInput {
  /** Height of the space the grid may occupy. */
  available: number
  /** The sticky day-header row. */
  header: number
  /** Borders plus any horizontal scrollbar. */
  chrome: number
  /** Axis total in hour units — collapsed gaps count less than their duration. */
  units: number
}

/**
 * Pixels per hour, chosen so the columns fill the space exactly.
 *
 * Deliberately has **no upper bound**. Capping it is what used to make the grid
 * collapse by 71% the moment the first activity was added: an empty grid draws
 * 16 invented hours, while one activity yields an axis of ~2.7 units, and a
 * ceiling rendered that as a fraction of the height. Letting the scale grow
 * keeps the card exactly the same size at every content size, so it never
 * resizes under the user.
 *
 * The lower bound stays: a dense routine on a short screen must overflow and
 * scroll rather than squash into illegibility.
 */
export function hourHeightFor({ available, header, chrome, units }: FitInput): number {
  if (!Number.isFinite(available) || available <= 0) return DEFAULT_HOUR_PX
  if (!Number.isFinite(units) || units <= 0) return DEFAULT_HOUR_PX

  const forColumns = available - header - chrome
  if (forColumns <= 0) return MIN_HOUR_PX

  return Math.max(MIN_HOUR_PX, forColumns / units)
}
