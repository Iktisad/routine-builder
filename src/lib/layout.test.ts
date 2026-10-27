import { describe, expect, it } from 'vitest'
import { buildAxis } from './axis'
import { MAX_INSET_DEPTH, intersectsWindow, layoutDay } from './layout'
import type { VisibleRange } from './range'
import type { Activity } from '../types'

const H = (h: number) => h * 60
const WINDOW: VisibleRange = { dayStart: H(7), dayEnd: H(23), bare: false }
/** An axis with nothing collapsed, so positions stay linear and checkable. */
const linearAxis = buildAxis([], WINDOW)

function activity(id: string, start: number, end: number): Activity {
  return { id, title: id, day: 0, start, end, color: 'blue' }
}

const depthsById = (list: Activity[]) =>
  Object.fromEntries(layoutDay(list, linearAxis).map((p) => [p.activity.id, p.depth]))

describe('intersectsWindow', () => {
  it('includes partial overlaps and excludes ranges fully outside', () => {
    expect(intersectsWindow(activity('a', H(6), H(8)), H(7), H(23))).toBe(true)
    expect(intersectsWindow(activity('b', H(5), H(7)), H(7), H(23))).toBe(false)
    expect(intersectsWindow(activity('c', H(23), H(24)), H(7), H(23))).toBe(false)
  })
})

describe('layoutDay — vertical position', () => {
  it('positions a single activity as a fraction of the window', () => {
    const [block] = layoutDay([activity('a', H(9), H(10))], linearAxis)
    expect(block.top).toBeCloseTo(2 / 16)
    expect(block.height).toBeCloseTo(1 / 16)
    expect(block.depth).toBe(0)
  })

  it('clamps and flags activities that run past the window edges', () => {
    const [early] = layoutDay([activity('a', H(6), H(8))], linearAxis)
    expect(early.top).toBe(0)
    expect(early.height).toBeCloseTo(1 / 16)
    expect(early.clippedStart).toBe(true)
    expect(early.clippedEnd).toBe(false)

    const [late] = layoutDay([activity('b', H(22), H(24))], linearAxis)
    expect(late.clippedEnd).toBe(true)
    expect(late.top + late.height).toBeCloseTo(1)
  })

  it('drops activities entirely outside the window', () => {
    expect(layoutDay([activity('a', 0, H(6))], linearAxis)).toEqual([])
  })

  it('returns nothing for an inverted window', () => {
    const inverted = buildAxis([], { dayStart: H(23), dayEnd: H(7), bare: false })
    expect(layoutDay([activity('a', H(9), H(10))], inverted)).toEqual([])
  })

  it('follows a collapsed axis rather than real time', () => {
    const activities = [activity('morning', H(9), H(10)), activity('evening', H(20), H(21))]
    const collapsed = buildAxis(activities, { dayStart: H(8), dayEnd: H(22), bare: false })
    const [morning, evening] = layoutDay(activities, collapsed)
    // Both are an hour long, so on a collapsed axis they are the same height…
    expect(morning.height).toBeCloseTo(evening.height)
    // …and the evening one sits far higher than real time would put it.
    expect(evening.top).toBeLessThan((H(20) - H(8)) / (H(22) - H(8)))
  })
})

describe('layoutDay — nesting depth', () => {
  it('leaves non-overlapping activities at depth 0', () => {
    expect(depthsById([activity('a', H(9), H(10)), activity('b', H(11), H(12))]))
      .toEqual({ a: 0, b: 0 })
  })

  it('treats back-to-back activities as non-overlapping', () => {
    expect(depthsById([activity('a', H(9), H(10)), activity('b', H(10), H(11))]))
      .toEqual({ a: 0, b: 0 })
  })

  it('nests a partial overlap one level deep', () => {
    expect(depthsById([activity('a', H(9), H(11)), activity('b', H(10), H(12))]))
      .toEqual({ a: 0, b: 1 })
  })

  it('nests a fully enclosed activity inside its container', () => {
    expect(depthsById([activity('outer', H(9), H(12)), activity('inner', H(10), H(11))]))
      .toEqual({ outer: 0, inner: 1 })
  })

  it('gives the longer activity the outer position on a shared start', () => {
    expect(depthsById([activity('short', H(9), H(9) + 30), activity('long', H(9), H(11))]))
      .toEqual({ long: 0, short: 1 })
  })

  it('stacks three concurrent activities one inside the next', () => {
    expect(depthsById([
      activity('a', H(9), H(12)),
      activity('b', H(9) + 30, H(12)),
      activity('c', H(10), H(12)),
    ])).toEqual({ a: 0, b: 1, c: 2 })
  })

  it('returns to depth 0 once a cluster has fully ended', () => {
    expect(depthsById([
      activity('a', H(9), H(11)),
      activity('b', H(10), H(12)),
      activity('later', H(13), H(14)),
    ])).toEqual({ a: 0, b: 1, later: 0 })
  })

  it('does not count an activity that already finished', () => {
    // 'a' ends at 10:00, so 'c' at 10:30 is nested inside 'b' only — the naive
    // stack would leave 'a' underneath and report depth 2.
    expect(depthsById([
      activity('a', H(9), H(10)),
      activity('b', H(9) + 30, H(11)),
      activity('c', H(10) + 30, H(10) + 45),
    ])).toEqual({ a: 0, b: 1, c: 1 })
  })

  it('reports true depth past the inset cap so stacking keeps working', () => {
    const deep = Array.from({ length: MAX_INSET_DEPTH + 3 }, (_, i) =>
      activity(`a${i}`, H(9) + i * 5, H(14)),
    )
    const depths = layoutDay(deep, linearAxis).map((p) => p.depth)
    expect(depths).toEqual(deep.map((_, i) => i))
    expect(Math.max(...depths)).toBeGreaterThan(MAX_INSET_DEPTH)
  })
})
