import { describe, expect, it } from 'vitest'
import { TAP_MAX_DURATION, TAP_MAX_MOVE, isTap } from './gesture'

describe('isTap', () => {
  it('accepts a still, brief touch', () => {
    expect(isTap({ dx: 0, dy: 0, elapsed: 80 })).toBe(true)
    expect(isTap({ dx: 3, dy: -4, elapsed: 200 })).toBe(true)
  })

  it('rejects a swipe — the gesture that must scroll instead', () => {
    expect(isTap({ dx: 0, dy: 40, elapsed: 160 })).toBe(false)
    expect(isTap({ dx: -60, dy: 0, elapsed: 160 })).toBe(false)
  })

  it('rejects a press and hold', () => {
    expect(isTap({ dx: 0, dy: 0, elapsed: TAP_MAX_DURATION + 1 })).toBe(false)
  })

  it('measures drift diagonally, not per axis', () => {
    // 9 + 9 is under the limit on each axis but ~12.7 as a distance.
    expect(isTap({ dx: 9, dy: 9, elapsed: 100 })).toBe(false)
    expect(isTap({ dx: TAP_MAX_MOVE, dy: 0, elapsed: 100 })).toBe(true)
  })

  it('is defensive about nonsense input', () => {
    expect(isTap({ dx: Number.NaN, dy: 0, elapsed: 10 })).toBe(false)
    expect(isTap({ dx: 0, dy: 0, elapsed: -5 })).toBe(false)
  })
})
