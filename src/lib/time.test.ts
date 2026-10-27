import { describe, expect, it } from 'vitest'
import {
  ceilToHour,
  ceilToSlot,
  clampMinutes,
  floorToHour,
  floorToSlot,
  formatDuration,
  formatRange,
  formatTime,
  fromTimeInput,
  nowMinutes,
  overlaps,
  snapMinutes,
  toTimeInput,
} from './time'

describe('clampMinutes', () => {
  it('clamps to the day and rounds to whole minutes', () => {
    expect(clampMinutes(-30)).toBe(0)
    expect(clampMinutes(9999)).toBe(1440)
    expect(clampMinutes(540.6)).toBe(541)
  })

  it('honours custom bounds', () => {
    expect(clampMinutes(100, 420, 1380)).toBe(420)
    expect(clampMinutes(1400, 420, 1380)).toBe(1380)
  })
})

describe('snapping', () => {
  it('rounds to the nearest slot', () => {
    expect(snapMinutes(557, 30)).toBe(570)
    expect(snapMinutes(551, 30)).toBe(540)
    expect(snapMinutes(551, 15)).toBe(555)
  })

  it('floors and ceils to slots and hours', () => {
    expect(floorToSlot(557, 30)).toBe(540)
    expect(ceilToSlot(541, 30)).toBe(570)
    expect(floorToHour(555)).toBe(540)
    expect(ceilToHour(555)).toBe(600)
    expect(ceilToHour(540)).toBe(540)
  })
})

describe('time input round trip', () => {
  it('converts both directions', () => {
    expect(toTimeInput(555)).toBe('09:15')
    expect(fromTimeInput('09:15')).toBe(555)
    expect(fromTimeInput('00:00')).toBe(0)
    expect(fromTimeInput('23:59')).toBe(1439)
  })

  it('represents end-of-day as 23:59 since 24:00 is not a valid input value', () => {
    expect(toTimeInput(1440)).toBe('23:59')
  })

  it('rejects malformed and out-of-range values', () => {
    expect(fromTimeInput('')).toBeNull()
    expect(fromTimeInput('9am')).toBeNull()
    expect(fromTimeInput('24:00')).toBeNull()
    expect(fromTimeInput('10:75')).toBeNull()
  })
})

describe('formatting', () => {
  it('drops :00 on whole hours', () => {
    expect(formatTime(540)).toBe('9 AM')
    expect(formatTime(555)).toBe('9:15 AM')
    expect(formatTime(720)).toBe('12 PM')
    expect(formatTime(0)).toBe('12 AM')
    expect(formatTime(1380)).toBe('11 PM')
  })

  it('wraps end-of-day to midnight', () => {
    expect(formatTime(1440)).toBe('12 AM')
  })

  it('supports 24-hour output', () => {
    expect(formatTime(555, false)).toBe('09:15')
  })

  it('formats ranges and durations', () => {
    expect(formatRange(555, 640)).toBe('9:15 AM – 10:40 AM')
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(85)).toBe('1h 25m')
  })
})

describe('overlaps', () => {
  it('treats touching ranges as non-overlapping', () => {
    expect(overlaps({ start: 540, end: 600 }, { start: 600, end: 660 })).toBe(false)
    expect(overlaps({ start: 540, end: 601 }, { start: 600, end: 660 })).toBe(true)
  })
})

describe('nowMinutes', () => {
  it('reads local wall-clock minutes', () => {
    const date = new Date(2026, 9, 26, 14, 35)
    expect(nowMinutes(date)).toBe(14 * 60 + 35)
  })
})
