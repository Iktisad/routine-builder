export const MINUTES_IN_DAY = 1440

const pad = (n: number) => String(n).padStart(2, '0')

export function clampMinutes(value: number, min = 0, max = MINUTES_IN_DAY): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Round to the nearest `slot` boundary. */
export function snapMinutes(value: number, slot: number): number {
  return Math.round(value / slot) * slot
}

export function floorToSlot(value: number, slot: number): number {
  return Math.floor(value / slot) * slot
}

export function ceilToSlot(value: number, slot: number): number {
  return Math.ceil(value / slot) * slot
}

export function floorToHour(value: number): number {
  return Math.floor(value / 60) * 60
}

export function ceilToHour(value: number): number {
  return Math.ceil(value / 60) * 60
}

/**
 * Value for `<input type="time">`. Midnight-as-end-of-day (1440) has no valid
 * 24h representation, so it renders as 23:59 — a minute of drift if the user
 * then re-submits that field untouched.
 */
export function toTimeInput(minutes: number): string {
  const m = clampMinutes(minutes)
  if (m >= MINUTES_IN_DAY) return '23:59'
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** Parse an `<input type="time">` value. Returns null when unparseable. */
export function fromTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** "9 AM", "9:15 AM". Whole hours drop the ":00" to keep the gutter narrow. */
export function formatTime(minutes: number, hour12 = true): string {
  const total = ((Math.round(minutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!hour12) return `${pad(h)}:${pad(m)}`
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12} ${period}` : `${h12}:${pad(m)} ${period}`
}

export function formatRange(start: number, end: number): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

/** "45m", "2h", "1h 25m". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/** Minutes from midnight for right now, in local time. */
export function nowMinutes(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}
