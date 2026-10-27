import { describe, expect, it } from 'vitest'
import { formatShortcut, isTextEntry } from './platform'

describe('formatShortcut', () => {
  it('uses the command glyph on Apple platforms', () => {
    expect(formatShortcut('z', true)).toBe('⌘Z')
    expect(formatShortcut('S', true)).toBe('⌘S')
  })

  it('spells out Ctrl everywhere else', () => {
    expect(formatShortcut('z', false)).toBe('Ctrl+Z')
    expect(formatShortcut('p', false)).toBe('Ctrl+P')
  })
})

describe('isTextEntry', () => {
  const fake = (tagName: string, contentEditable = false) =>
    ({ tagName, isContentEditable: contentEditable }) as unknown as EventTarget

  it('recognises the fields where the browser should own undo', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isTextEntry(fake(tag))).toBe(true)
    }
    expect(isTextEntry(fake('DIV', true))).toBe(true)
  })

  it('leaves everything else to the app', () => {
    expect(isTextEntry(fake('DIV'))).toBe(false)
    expect(isTextEntry(fake('BUTTON'))).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })
})
