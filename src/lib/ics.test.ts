import { describe, expect, it } from 'vitest'
import {
  addMonthsIso,
  buildCalendar,
  escapeText,
  foldLine,
  formatUntil,
  isUntilInPast,
  occurrenceDate,
  sequenceFor,
} from './ics'
import { defaultSettings } from './schema'
import type { Activity, DayIndex, Routine } from '../types'

const H = (h: number, m = 0) => h * 60 + m

function activity(over: Partial<Activity> = {}): Activity {
  return { id: 'a1', title: 'Deep work', day: 1, start: H(9), end: H(11), color: 'blue', ...over }
}

function routine(over: Partial<Routine> = {}): Routine {
  return {
    version: 1,
    name: 'Sample week',
    updatedAt: '2026-10-27T10:00:00.000Z',
    settings: { ...defaultSettings(), calendarUntil: '2027-04-27' },
    activities: [activity()],
    ...over,
  }
}

/** Unfold continuation lines so assertions can look at logical values. */
const unfold = (ics: string) => ics.replace(/\r\n /g, '')
const linesOf = (ics: string) => unfold(ics).split('\r\n')
const NOW = new Date(2026, 9, 27, 12, 0, 0) // Tuesday 27 Oct 2026, local

describe('escapeText', () => {
  // String.raw throughout: a bare '\;' literal collapses to ';' and would
  // assert the opposite of what it appears to say.
  it('escapes the four special sequences, backslash first', () => {
    expect(escapeText(String.raw`a\b`)).toBe(String.raw`a\\b`)
    expect(escapeText('Gym; lift')).toBe(String.raw`Gym\; lift`)
    expect(escapeText('eggs, milk')).toBe(String.raw`eggs\, milk`)
    expect(escapeText('one\ntwo')).toBe(String.raw`one\ntwo`)
  })

  it('does not double-escape a backslash it just added', () => {
    expect(escapeText('a;b')).toBe(String.raw`a\;b`)
    // a real backslash then a semicolon -> escaped backslash, escaped semicolon
    expect(escapeText(String.raw`\;`)).toBe(String.raw`\\\;`)
  })
})

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds past 75 octets with a leading space on continuations', () => {
    const folded = foldLine(`SUMMARY:${'x'.repeat(200)}`)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true)
    for (const part of parts) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'x'.repeat(200)}`)
  })

  it('never splits a multi-byte character', () => {
    const folded = foldLine(`SUMMARY:${'é'.repeat(80)}`)
    for (const part of folded.split('\r\n')) {
      expect(part).not.toContain('�')
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'é'.repeat(80)}`)
  })
})

describe('formatUntil', () => {
  it('produces a floating end-of-day stamp with no Z', () => {
    expect(formatUntil('2027-04-27')).toBe('20270427T235959')
    expect(formatUntil('2027-04-27')).not.toMatch(/Z$/)
  })

  it('rejects malformed or impossible dates', () => {
    expect(formatUntil('nope')).toBeNull()
    expect(formatUntil('2027-4-27')).toBeNull()
    expect(formatUntil('2027-02-30')).toBeNull()
  })
})

describe('sequenceFor', () => {
  it('rises as the routine is edited', () => {
    const earlier = sequenceFor('2026-10-27T10:00:00.000Z')
    const later = sequenceFor('2026-10-27T10:05:00.000Z')
    expect(later).toBeGreaterThan(earlier)
    expect(later - earlier).toBe(5)
  })

  it('is a non-negative integer even for nonsense input', () => {
    expect(sequenceFor('not a date')).toBe(0)
    expect(sequenceFor('2020-01-01T00:00:00.000Z')).toBe(0)
    expect(Number.isInteger(sequenceFor('2026-10-27T10:00:00.000Z'))).toBe(true)
  })
})

describe('occurrenceDate', () => {
  it('lands on the right weekday of the current week, Sunday-first', () => {
    for (let day = 0; day < 7; day += 1) {
      const d = occurrenceDate(day as DayIndex, H(9), NOW)
      expect(d.getDay()).toBe(day)
      expect(d.getHours()).toBe(9)
    }
  })

  it('rolls an end of midnight into the following day', () => {
    const d = occurrenceDate(6, 1440, NOW)
    expect(d.getDay()).toBe(0)
    expect(d.getHours()).toBe(0)
  })
})

describe('buildCalendar', () => {
  it('wraps events in a well-formed calendar', () => {
    const ics = buildCalendar(routine(), { now: NOW })
    const lines = linesOf(ics)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines).toContain('CALSCALE:GREGORIAN')
    expect(lines.at(-2)).toBe('END:VCALENDAR')
  })

  it('uses CRLF line endings throughout, including a trailing one', () => {
    const ics = buildCalendar(routine(), { now: NOW })
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('emits one VEVENT per activity', () => {
    const ics = buildCalendar(
      routine({ activities: [activity({ id: 'a' }), activity({ id: 'b' }), activity({ id: 'c' })] }),
      { now: NOW },
    )
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(ics.match(/END:VEVENT/g)).toHaveLength(3)
  })

  it('maps every day index to the right BYDAY code', () => {
    const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
    for (let day = 0; day < 7; day += 1) {
      const ics = buildCalendar(routine({ activities: [activity({ day: day as DayIndex })] }), { now: NOW })
      expect(unfold(ics)).toContain(`BYDAY=${codes[day]}`)
    }
  })

  it('repeats weekly and stops at the chosen date', () => {
    const ics = unfold(buildCalendar(routine(), { now: NOW }))
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270427T235959')
  })

  it('keeps UNTIL floating, matching the floating DTSTART', () => {
    const ics = unfold(buildCalendar(routine(), { now: NOW }))
    const dtstart = /DTSTART:(\S+)/.exec(ics)![1]
    const until = /UNTIL=([^;\r\n]+)/.exec(ics)![1]
    expect(dtstart).not.toMatch(/Z$/)
    expect(until).not.toMatch(/Z$/)
  })

  it('writes DTSTART at the activity local time on the right weekday', () => {
    const ics = unfold(buildCalendar(routine({ activities: [activity({ day: 3, start: H(9, 15), end: H(10, 40) })] }), { now: NOW }))
    // Wednesday of the week containing Tue 27 Oct 2026 is the 28th.
    expect(ics).toContain('DTSTART:20261028T091500')
    expect(ics).toContain('DTEND:20261028T104000')
  })

  // The crux of "edits revise rather than duplicate".
  it('derives a stable UID from the activity id', () => {
    const first = buildCalendar(routine(), { now: NOW })
    const second = buildCalendar(routine({ name: 'Renamed' }), { now: new Date(2026, 11, 1) })
    expect(unfold(first)).toContain('UID:a1@routine-builder')
    expect(unfold(second)).toContain('UID:a1@routine-builder')
  })

  it('changes the UID only when the activity id does', () => {
    const ics = unfold(buildCalendar(routine({ activities: [activity({ id: 'different' })] }), { now: NOW }))
    expect(ics).toContain('UID:different@routine-builder')
    expect(ics).not.toContain('UID:a1@routine-builder')
  })

  it('raises SEQUENCE when the routine is edited', () => {
    const before = unfold(buildCalendar(routine(), { now: NOW }))
    const after = unfold(buildCalendar(routine({ updatedAt: '2026-10-27T11:00:00.000Z' }), { now: NOW }))
    const read = (s: string) => Number(/SEQUENCE:(\d+)/.exec(s)![1])
    expect(read(after)).toBeGreaterThan(read(before))
  })

  it('escapes text fields and carries optional ones only when present', () => {
    const ics = unfold(buildCalendar(
      routine({ activities: [activity({ title: 'Gym; lift, hard', location: 'A,B', note: 'one\ntwo' })] }),
      { now: NOW },
    ))
    expect(ics).toContain(String.raw`SUMMARY:Gym\; lift\, hard`)
    expect(ics).toContain(String.raw`LOCATION:A\,B`)
    expect(ics).toContain(String.raw`DESCRIPTION:one\ntwo`)

    const bare = unfold(buildCalendar(routine(), { now: NOW }))
    expect(bare).not.toContain('LOCATION:')
    expect(bare).not.toContain('DESCRIPTION:')
  })

  it('still produces a valid file when the horizon is unusable', () => {
    const ics = unfold(buildCalendar(routine({ settings: { ...defaultSettings(), calendarUntil: 'junk' } }), { now: NOW }))
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO')
    expect(ics).not.toContain('UNTIL=')
  })

  it('folds a long title rather than emitting an over-length line', () => {
    const ics = buildCalendar(routine({ activities: [activity({ title: 'A'.repeat(200) })] }), { now: NOW })
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})

describe('horizon helpers', () => {
  it('advances by whole months', () => {
    expect(addMonthsIso(3, new Date(2026, 9, 27))).toBe('2027-01-27')
    expect(addMonthsIso(12, new Date(2026, 9, 27))).toBe('2027-10-27')
  })

  it('spots a horizon that has already passed', () => {
    expect(isUntilInPast('2020-01-01', NOW)).toBe(true)
    expect(isUntilInPast('2027-04-27', NOW)).toBe(false)
    expect(isUntilInPast('junk', NOW)).toBe(false)
  })
})
