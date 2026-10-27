import { buildCalendar } from './ics'
import type { Routine } from '../types'
import { validateRoutine, type ValidationResult } from './schema'

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'routine'
}

export function routineFilename(routine: Routine, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10)
  return `routine-${slugify(routine.name)}-${stamp}.json`
}

export function serializeRoutine(routine: Routine): string {
  return `${JSON.stringify({ ...routine, updatedAt: new Date().toISOString() }, null, 2)}\n`
}

/** Download the routine as JSON. The only durable copy — there is no storage. */
export function downloadRoutine(routine: Routine): void {
  const blob = new Blob([serializeRoutine(routine)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = routineFilename(routine)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function calendarFilename(routine: Routine): string {
  return `routine-${slugify(routine.name)}.ics`
}

/**
 * Download the routine as an iCalendar file for the device's default calendar.
 * Shares the Blob/object-URL path with `downloadRoutine`; only the payload,
 * MIME type and extension differ.
 */
export function downloadCalendar(routine: Routine): string {
  const blob = new Blob([buildCalendar(routine)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = calendarFilename(routine)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return anchor.download
}

export async function readRoutineFile(file: File): Promise<ValidationResult> {
  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: 'That file could not be read.' }
  }
  try {
    return validateRoutine(JSON.parse(text))
  } catch {
    return { ok: false, error: `"${file.name}" is not valid JSON.` }
  }
}
