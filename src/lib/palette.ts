import { COLOR_KEYS, type ColorKey } from '../types'

/**
 * Keys are frozen for backwards compatibility — a routine exported before the
 * palette was retuned still imports; only the rendered colour and label moved.
 */
export const COLOR_LABELS: Record<ColorKey, string> = {
  blue: 'Ink',
  violet: 'Periwinkle',
  rose: 'Plum',
  orange: 'Coral',
  amber: 'Sienna',
  lime: 'Olive',
  teal: 'Pine',
  cyan: 'Teal',
}

/**
 * Block colours are CSS custom properties rather than Tailwind classes: a
 * dynamic `bg-${key}-100` would be purged at build time, and vars let light,
 * dark and print variants swap with no re-render.
 */
export function colorStyle(key: ColorKey) {
  return {
    background: `var(--c-${key}-bg)`,
    borderColor: `var(--c-${key}-border)`,
    color: `var(--c-${key}-text)`,
  }
}

export function swatchStyle(key: ColorKey) {
  return { background: `var(--c-${key}-border)` }
}

export function isColorKey(value: unknown): value is ColorKey {
  return typeof value === 'string' && (COLOR_KEYS as readonly string[]).includes(value)
}
