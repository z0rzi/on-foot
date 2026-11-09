import { darkColors, lightColors } from '../../theme/colors'
import { cardSurfaces } from '../cardSurface'

const alpha = (colour: string) => {
  const rgba = /^rgba\(.*,\s*([\d.]+)\)$/.exec(colour)
  return rgba ? Number(rgba[1]) : 1
}

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('the card in the %s theme', (_, c) => {
  test("collapsed, it wears the pill's surface, which lets the map through", () => {
    expect(cardSurfaces(c).collapsed).toBe(c.pillSurface)
    expect(alpha(cardSurfaces(c).collapsed)).toBeLessThan(1)
  })
  test('open, it is the opaque surface', () => {
    expect(cardSurfaces(c).open).toBe(c.surface)
    expect(alpha(cardSurfaces(c).open)).toBe(1)
  })
})
