import { describe, expect, it } from 'vitest'
import { CANVAS_FALLBACK, MIN_SPAN_MINUTES, visibleRange } from './range'
import { defaultSettings } from './schema'
import type { Activity, RoutineSettings } from '../types'

const settings = (over: Partial<RoutineSettings> = {}): RoutineSettings => ({
  ...defaultSettings(),
  ...over,
})

function activity(start: number, end: number, id = `${start}-${end}`): Activity {
  return { id, title: id, day: 0, start, end, color: 'blue' }
}

const H = (hours: number) => hours * 60
const onWholeHours = (r: { dayStart: number; dayEnd: number }) =>
  r.dayStart % 60 === 0 && r.dayEnd % 60 === 0

describe('visibleRange — empty', () => {
  it('returns a bare canvas so dragging still works before anything exists', () => {
    const range = visibleRange([], settings())
    expect(range.bare).toBe(true)
    expect(range.dayStart).toBe(CANVAS_FALLBACK.dayStart)
    expect(range.dayEnd).toBe(CANVAS_FALLBACK.dayEnd)
  })
})

describe('visibleRange — auto fit', () => {
  it('pads an hour either side and rounds out to whole hours', () => {
    // 09:15–15:40 -> floor 09:00 minus 1h = 08:00, ceil 16:00 plus 1h = 17:00.
    // Long enough that the padding alone clears the minimum span.
    const range = visibleRange([activity(555, H(15) + 40)], settings())
    expect(range.bare).toBe(false)
    expect(range).toMatchObject({ dayStart: H(8), dayEnd: H(17) })
    expect(onWholeHours(range)).toBe(true)
  })

  it('applies the minimum span when padding alone is not enough', () => {
    // 09:15–10:40 pads to 08:00–12:00, only 4h, so it grows to 6h.
    const range = visibleRange([activity(555, 640)], settings())
    expect(range.dayEnd - range.dayStart).toBe(MIN_SPAN_MINUTES)
    expect(range).toMatchObject({ dayStart: H(7), dayEnd: H(13) })
  })

  it('spans the earliest start to the latest end across many activities', () => {
    const range = visibleRange(
      [activity(H(9), H(10)), activity(H(21), H(22)), activity(H(13), H(14))],
      settings(),
    )
    expect(range).toMatchObject({ dayStart: H(8), dayEnd: H(23) })
  })

  it('keeps the gap between distant activities proportional, not collapsed', () => {
    const range = visibleRange([activity(H(8), H(9)), activity(H(20), H(21))], settings())
    // 7am -> 10pm is 15 hours: the 11-hour gap is still in the span.
    expect(range.dayEnd - range.dayStart).toBe(H(15))
  })

  it('expands a short routine up to the minimum span', () => {
    const range = visibleRange([activity(H(12), H(12) + 30)], settings())
    expect(range.dayEnd - range.dayStart).toBeGreaterThanOrEqual(MIN_SPAN_MINUTES)
    expect(onWholeHours(range)).toBe(true)
    // the activity still sits inside the window
    expect(range.dayStart).toBeLessThanOrEqual(H(12))
    expect(range.dayEnd).toBeGreaterThanOrEqual(H(12) + 30)
  })

  it('does not run past midnight at the top', () => {
    const range = visibleRange([activity(0, 30)], settings())
    expect(range.dayStart).toBe(0)
    expect(range.dayEnd - range.dayStart).toBeGreaterThanOrEqual(MIN_SPAN_MINUTES)
  })

  it('does not run past midnight at the bottom', () => {
    const range = visibleRange([activity(H(23) + 30, 1440)], settings())
    expect(range.dayEnd).toBe(1440)
    expect(range.dayStart).toBeGreaterThanOrEqual(0)
    expect(range.dayEnd - range.dayStart).toBeGreaterThanOrEqual(MIN_SPAN_MINUTES)
    expect(range.dayStart).toBeLessThanOrEqual(H(23) + 30)
  })

  it('handles a routine that already covers the whole day', () => {
    const range = visibleRange([activity(0, 1440)], settings())
    expect(range).toMatchObject({ dayStart: 0, dayEnd: 1440 })
  })

  it('always contains every activity it was given', () => {
    const cases: Activity[][] = [
      [activity(H(6), H(7))],
      [activity(H(1), H(2)), activity(H(23), 1440)],
      [activity(H(11), H(11) + 15)],
      [activity(0, 15)],
      [activity(1425, 1440)],
    ]
    for (const list of cases) {
      const range = visibleRange(list, settings())
      for (const a of list) {
        expect(range.dayStart).toBeLessThanOrEqual(a.start)
        expect(range.dayEnd).toBeGreaterThanOrEqual(a.end)
      }
      expect(onWholeHours(range)).toBe(true)
    }
  })
})

describe('visibleRange — manual override', () => {
  it('honours the settings verbatim when auto-fit is off', () => {
    const range = visibleRange(
      [activity(H(9), H(10))],
      settings({ autoFitHours: false, dayStart: H(7), dayEnd: H(23) }),
    )
    expect(range).toEqual({ dayStart: H(7), dayEnd: H(23), bare: false })
  })

  it('is never bare when auto-fit is off, even with no activities', () => {
    const range = visibleRange([], settings({ autoFitHours: false }))
    expect(range.bare).toBe(false)
  })
})
