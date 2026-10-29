/** How far a finger may drift and still count as a tap rather than a scroll. */
export const TAP_MAX_MOVE = 12

/** Longer than this is a press-and-hold, not a tap. */
export const TAP_MAX_DURATION = 600

export interface TapCandidate {
  dx: number
  dy: number
  /** Milliseconds between pointerdown and pointerup. */
  elapsed: number
}

/**
 * Whether a finished touch gesture was a tap.
 *
 * On touch the grid must stay scrollable, so a swipe can never be allowed to
 * create an activity — only a gesture that stayed put and was brief counts.
 */
export function isTap({ dx, dy, elapsed }: TapCandidate): boolean {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(elapsed)) return false
  if (elapsed < 0 || elapsed > TAP_MAX_DURATION) return false
  return Math.hypot(dx, dy) <= TAP_MAX_MOVE
}
