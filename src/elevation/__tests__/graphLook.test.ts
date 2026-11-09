import { graphLook } from '../graphLook'
import { darkColors, lightColors } from '../../theme/colors'

const themes = [lightColors, darkColors]

describe('graphLook', () => {
  test.each(themes)("the line in the card's text colour", (c) => {
    expect(graphLook(c).line).toBe(c.onSurface)
  })
  test.each(themes)('each band in its slope colour, flat in a grey that stands out from the card', (c) => {
    const look = graphLook(c)
    expect(look.fill('flat')).toBe(c.slopeFlatOnPanel)
    expect(look.fill('flat')).not.toBe(c.surface)
    expect(look.fill('steep')).toBe(c.slopeSteep)
  })
  test.each(themes)('each band fades from its full colour at the top to nothing at the bottom', (c) => {
    expect(graphLook(c).fade).toEqual([
      { offset: 0, opacity: 1 },
      { offset: 0.6, opacity: 0.45 },
      { offset: 1, opacity: 0 },
    ])
  })
  test.each(themes)("a y-axis in the card's secondary text colour", (c) => {
    expect(graphLook(c).axis).toBe(c.onSurfaceVariant)
  })
})
