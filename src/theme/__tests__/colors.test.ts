import { getColors, lightColors, darkColors } from '../colors'

test('trail line is purple in both themes', () => {
  expect(lightColors.trailLine).toBe('#9C27B0')
  expect(darkColors.trailLine).toBe('#9C27B0')
})

test('getColors selects palette by scheme, defaulting to light', () => {
  expect(getColors('dark')).toBe(darkColors)
  expect(getColors('light')).toBe(lightColors)
  expect(getColors(null)).toBe(lightColors)
})

test('control surface differs between light and dark', () => {
  expect(lightColors.controlSurface).toBe('#FFFFFF')
  expect(darkColors.controlSurface).toBe('#2D2D2D')
})

test('difficulty colors are defined in both themes', () => {
  for (const c of [lightColors, darkColors]) {
    expect(c.difficultyEasy).toMatch(/^#/)
    expect(c.difficultyMedium).toMatch(/^#/)
    expect(c.difficultyHard).toMatch(/^#/)
  }
})
