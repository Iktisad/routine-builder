import { describe, expect, it } from 'vitest'
import { routineFilename, serializeRoutine, slugify } from './io'
import { createId, defaultRoutine, sampleRoutine, validateRoutine } from './schema'
import { ROUTINE_VERSION, type Routine } from '../types'

describe('defaults', () => {
  it('starts empty, Sunday through Saturday, 7am to 11pm', () => {
    const routine = defaultRoutine()
    expect(routine.activities).toEqual([])
    expect(routine.settings.visibleDays).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(routine.settings.dayStart).toBe(420)
    expect(routine.settings.dayEnd).toBe(1380)
    expect(routine.version).toBe(ROUTINE_VERSION)
  })

  it('issues unique ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId()))
    expect(ids.size).toBe(200)
  })

  it('builds a valid sample week', () => {
    const result = validateRoutine(JSON.parse(JSON.stringify(sampleRoutine())))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.warnings).toEqual([])
  })
})

describe('export/import round trip', () => {
  it('preserves every activity field', () => {
    const original: Routine = {
      ...defaultRoutine(),
      name: 'Fall semester',
      settings: { dayStart: 360, dayEnd: 1320, slotMinutes: 15, visibleDays: [0, 1, 2, 3, 4], autoFitHours: false, calendarUntil: '2027-04-27' },
      activities: [
        {
          id: 'a1',
          title: 'Arabic class',
          day: 1,
          start: 555,
          end: 640,
          color: 'violet',
          location: 'Room 204',
          note: 'bring workbook',
        },
      ],
    }

    const result = validateRoutine(JSON.parse(serializeRoutine(original)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routine.name).toBe('Fall semester')
    expect(result.routine.settings).toEqual(original.settings)
    expect(result.routine.activities).toEqual(original.activities)
    expect(result.warnings).toEqual([])
  })
})

describe('validateRoutine', () => {
  const base = { version: ROUTINE_VERSION, name: 'x', activities: [] }

  it('rejects non-objects and wrong versions', () => {
    expect(validateRoutine(null).ok).toBe(false)
    expect(validateRoutine('nope').ok).toBe(false)
    expect(validateRoutine([]).ok).toBe(false)
    expect(validateRoutine({ ...base, version: 2 }).ok).toBe(false)
  })

  it('rejects a missing activities list', () => {
    const result = validateRoutine({ version: ROUTINE_VERSION, name: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/activities/)
  })

  it('skips individual bad activities rather than failing the file', () => {
    const result = validateRoutine({
      ...base,
      activities: [
        { id: 'ok', title: 'Good', day: 2, start: 540, end: 600, color: 'teal' },
        { id: 'bad-day', title: 'Nope', day: 9, start: 540, end: 600 },
        { id: 'inverted', title: 'Nope', day: 2, start: 600, end: 540 },
        { id: 'past-midnight', title: 'Nope', day: 2, start: 1400, end: 1500 },
        { title: 'No day' },
        'not an object',
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routine.activities.map((a) => a.id)).toEqual(['ok'])
    expect(result.warnings.some((w) => /5 activities were skipped/.test(w))).toBe(true)
  })

  it('falls back to a known colour and defaults missing settings', () => {
    const result = validateRoutine({
      ...base,
      activities: [{ id: 'a', title: 'A', day: 0, start: 540, end: 600, color: 'chartreuse' }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routine.activities[0].color).toBe('blue')
    expect(result.routine.settings).toEqual(defaultRoutine().settings)
    expect(result.warnings.some((w) => /Settings were missing/.test(w))).toBe(true)
  })

  it('re-issues duplicate and missing ids', () => {
    const result = validateRoutine({
      ...base,
      activities: [
        { id: 'dup', title: 'A', day: 0, start: 540, end: 600 },
        { id: 'dup', title: 'B', day: 0, start: 600, end: 660 },
        { title: 'C', day: 0, start: 660, end: 720 },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ids = result.routine.activities.map((a) => a.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every(Boolean)).toBe(true)
  })

  it('snaps imported grid hours to whole hours and keeps the window valid', () => {
    const result = validateRoutine({
      ...base,
      settings: { dayStart: 455, dayEnd: 1385, slotMinutes: 7, visibleDays: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routine.settings.dayStart).toBe(420)
    expect(result.routine.settings.dayEnd).toBe(1440)
    expect(result.routine.settings.slotMinutes).toBe(30)
    expect(result.routine.settings.visibleDays).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('adopts auto-fit for routines exported before the flag existed', () => {
    const result = validateRoutine({
      ...base,
      settings: { dayStart: 420, dayEnd: 1380, slotMinutes: 30, visibleDays: [0, 1, 2] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routine.settings.autoFitHours).toBe(true)
  })

  it('drops unknown fields', () => {
    const result = validateRoutine({
      ...base,
      evil: 'payload',
      activities: [{ id: 'a', title: 'A', day: 0, start: 540, end: 600, evil: 'payload' }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect('evil' in result.routine).toBe(false)
    expect('evil' in result.routine.activities[0]).toBe(false)
  })
})

describe('filenames', () => {
  it('slugifies and falls back when a name has no usable characters', () => {
    expect(slugify('Fall Semester 2026!')).toBe('fall-semester-2026')
    expect(slugify('   ')).toBe('routine')
    expect(slugify('***')).toBe('routine')
  })

  it('stamps the date', () => {
    const name = routineFilename({ ...defaultRoutine(), name: 'My Week' }, new Date('2026-10-26T12:00:00Z'))
    expect(name).toBe('routine-my-week-2026-10-26.json')
  })
})
