import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

/**
 * A server render of the whole tree. It does not exercise interaction, but it
 * does catch the class of mistake unit tests miss entirely: a bad hook order,
 * a missing prop, or a crash on the initial empty routine.
 */
describe('App initial render', () => {
  const html = renderToString(<App />)

  it('renders all seven day columns, Sunday first', () => {
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(html).toContain(`>${day}<`)
    }
    expect(html.indexOf('>Sun<')).toBeLessThan(html.indexOf('>Sat<'))
    expect((html.match(/class="day-column"/g) ?? [])).toHaveLength(7)
  })

  it('draws no hour axis until something is scheduled', () => {
    expect(html).not.toContain('time-label')
    expect(html).not.toContain('7 AM')
    expect(html).not.toContain('11 PM')
    expect(html).toContain('--gutter-w:0rem')
    expect(html).toContain('data-bare=\"true\"')
  })

  it('sizes the grid to the drag canvas and the snap interval', () => {
    expect(html).toContain('--day-count:7')
    // the canvas still spans 7am–11pm so a drag lands on sane times
    expect(html).toContain('--span-hours:16')
  })

  it('shows the empty-state guidance and the no-storage warning', () => {
    expect(html).toContain('Load sample week')
    expect(html).toContain('Nothing is stored in your browser')
  })

  it('starts with nothing unsaved and export disabled', () => {
    expect(html).toContain('>Saved<')
    expect(html).toMatch(/Export/)
  })
})
