import { describe, expect, it } from 'vitest'
import {
  COLLAPSED_UNITS,
  GAP_THRESHOLD,
  buildAxis,
  projectMinute,
  unprojectFraction,
} from './axis'
import type { VisibleRange } from './range'
import type { Activity, DayIndex } from '../types'

const H = (h: number) => h * 60
const range = (startH: number, endH: number): VisibleRange => ({
  dayStart: H(startH),
  dayEnd: H(endH),
  bare: false,
})

function activity(start: number, end: number, day: DayIndex = 0, id = `${day}:${start}-${end}`): Activity {
  return { id, title: id, day, start, end, color: 'blue' }
}

describe('buildAxis — no collapsing', () => {
  it('is a single uniform segment when nothing is scheduled', () => {
    const axis = buildAxis([], range(7, 23))
    expect(axis.segments).toHaveLength(1)
    expect(axis.segments[0].collapsed).toBe(false)
    expect(axis.totalUnits).toBe(16)
    expect(axis.gaps).toEqual([])
    expect(axis.ticks).toEqual([])
  })

  it('projects linearly when there is nothing to collapse', () => {
    const axis = buildAxis([], range(8, 16))
    expect(projectMinute(axis, H(8))).toBeCloseTo(0)
    expect(projectMinute(axis, H(12))).toBeCloseTo(0.5)
    expect(projectMinute(axis, H(16))).toBeCloseTo(1)
  })

  it('leaves a gap shorter than the threshold to scale', () => {
    // 09:00–10:00 then 11:00–12:00: a 1h gap, under the 2h threshold.
    const axis = buildAxis([activity(H(9), H(10)), activity(H(11), H(12))], range(8, 13))
    expect(axis.gaps).toEqual([])
    expect(axis.totalUnits).toBe(5)
    expect(projectMinute(axis, H(10.5))).toBeCloseTo(2.5 / 5)
  })
})

describe('buildAxis — collapsing', () => {
  const activities = [activity(H(9), H(10)), activity(H(20), H(21))]
  const axis = buildAxis(activities, range(8, 22))

  it('collapses a long empty stretch', () => {
    expect(axis.gaps).toHaveLength(1)
    expect(axis.gaps[0].minutes).toBe(H(10))
  })

  it('makes the grid markedly shorter than real time', () => {
    // 8am–10pm is 14h; the 10h gap becomes 0.6 units.
    expect(axis.totalUnits).toBeCloseTo(1 + 1 + COLLAPSED_UNITS + 1 + 1)
    expect(axis.totalUnits).toBeLessThan(14)
  })

  it('keeps the uncollapsed parts to scale', () => {
    const nineToTen = projectMinute(axis, H(10)) - projectMinute(axis, H(9))
    const eightToNine = projectMinute(axis, H(9)) - projectMinute(axis, H(8))
    expect(nineToTen).toBeCloseTo(eightToNine)
  })

  it('a gap exactly at the threshold still collapses', () => {
    const exact = buildAxis(
      [activity(H(9), H(10)), activity(H(10) + GAP_THRESHOLD, H(13))],
      range(9, 13),
    )
    expect(exact.gaps).toHaveLength(1)
  })

  it('collapses leading and trailing emptiness too', () => {
    const padded = buildAxis([activity(H(12), H(13))], range(0, 24))
    expect(padded.gaps).toHaveLength(2)
  })
})

describe('buildAxis — visible days', () => {
  it('ignores activities on hidden days when finding gaps', () => {
    const activities = [activity(H(9), H(10), 0), activity(H(14), H(15), 3), activity(H(20), H(21), 0)]
    const all = buildAxis(activities, range(8, 22), [0, 1, 2, 3, 4, 5, 6])
    const hidden = buildAxis(activities, range(8, 22), [0])
    // With Wednesday visible its activity breaks the afternoon into two gaps.
    expect(all.gaps).toHaveLength(2)
    expect(hidden.gaps).toHaveLength(1)
    expect(hidden.gaps[0].minutes).toBe(H(10))
  })
})

describe('ticks', () => {
  it('labels exactly the activity boundaries', () => {
    const axis = buildAxis([activity(H(9), H(10)), activity(H(20), H(21))], range(8, 22))
    expect(axis.ticks).toEqual([H(9), H(10), H(20), H(21)])
  })

  it('drops a boundary that would collide with the previous label', () => {
    // 09:00 and 09:05 are 0.083 units apart, well under the 0.4 minimum.
    const axis = buildAxis([activity(H(9), H(11)), activity(H(9) + 5, H(11))], range(8, 12))
    expect(axis.ticks).toContain(H(9))
    expect(axis.ticks).not.toContain(H(9) + 5)
  })

  it('keeps boundaries that are comfortably apart', () => {
    const axis = buildAxis([activity(H(9), H(10)), activity(H(10) + 30, H(11))], range(8, 12))
    expect(axis.ticks).toEqual([H(9), H(10), H(10) + 30, H(11)])
  })
})

describe('project / unproject', () => {
  const axis = buildAxis([activity(H(9), H(10)), activity(H(20), H(21))], range(8, 22))

  it('round-trips across every segment edge', () => {
    for (const minute of [H(8), H(9), H(10), H(20), H(21), H(22)]) {
      expect(unprojectFraction(axis, projectMinute(axis, minute))).toBeCloseTo(minute, 4)
    }
  })

  it('round-trips inside the uncollapsed regions', () => {
    for (const minute of [H(8.5), H(9.25), H(20.75)]) {
      expect(unprojectFraction(axis, projectMinute(axis, minute))).toBeCloseTo(minute, 4)
    }
  })

  it('round-trips inside a collapsed band, coarsely but consistently', () => {
    const minute = H(15)
    expect(unprojectFraction(axis, projectMinute(axis, minute))).toBeCloseTo(minute, 4)
  })

  it('is monotonic', () => {
    let previous = -1
    for (let m = H(8); m <= H(22); m += 7) {
      const f = projectMinute(axis, m)
      expect(f).toBeGreaterThanOrEqual(previous)
      previous = f
    }
  })

  it('clamps outside the window', () => {
    expect(projectMinute(axis, 0)).toBe(0)
    expect(projectMinute(axis, 1440)).toBeCloseTo(1)
    expect(unprojectFraction(axis, -1)).toBe(H(8))
    expect(unprojectFraction(axis, 2)).toBe(H(22))
  })
})
