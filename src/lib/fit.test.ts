import { describe, expect, it } from 'vitest'
import { DEFAULT_HOUR_PX, MIN_HOUR_PX, hourHeightFor } from './fit'

const base = { available: 800, header: 60, chrome: 2 }
/** What the columns end up occupying for a given result. */
const columnsFor = (units: number) => hourHeightFor({ ...base, units }) * units

describe('hourHeightFor', () => {
  it('fills the available space exactly, whatever the content size', () => {
    const room = base.available - base.header - base.chrome
    for (const units of [2.7, 5.1, 14.85, 16]) {
      expect(columnsFor(units)).toBeCloseTo(room, 6)
    }
  })

  it('has no upper bound — this is what stops the grid resizing', () => {
    // One activity collapses the axis to ~2.7 units. Under the old 56px
    // ceiling that rendered 151px of columns instead of filling 738px.
    expect(hourHeightFor({ ...base, units: 2.7 })).toBeGreaterThan(200)
  })

  it('keeps the card the same height whether empty or populated', () => {
    const empty = columnsFor(16)
    const oneActivity = columnsFor(2.7)
    expect(oneActivity).toBeCloseTo(empty, 6)
  })

  it('clamps at the legible floor and lets a dense routine overflow', () => {
    const room = base.available - base.header - base.chrome
    const dense = hourHeightFor({ ...base, units: 60 })
    expect(dense).toBe(MIN_HOUR_PX)
    expect(dense * 60).toBeGreaterThan(room)
  })

  it('falls back before the container has been measured', () => {
    expect(hourHeightFor({ ...base, available: 0, units: 16 })).toBe(DEFAULT_HOUR_PX)
    expect(hourHeightFor({ ...base, units: 0 })).toBe(DEFAULT_HOUR_PX)
    expect(hourHeightFor({ ...base, units: Number.NaN })).toBe(DEFAULT_HOUR_PX)
  })

  it('does not return a negative scale when chrome swallows the space', () => {
    expect(hourHeightFor({ available: 50, header: 60, chrome: 2, units: 16 })).toBe(MIN_HOUR_PX)
  })
})
