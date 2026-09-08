import { getColors, lightColors, darkColors } from '../colors'

test('trail line is purple in both themes', () => {
  expect(lightColors.trailLine).toBe('#9C27B0')
  expect(darkColors.trailLine).toBe('#9C27B0')
})

test('getColors selects palette by scheme, defaulting to light', () => {
  expect(getColors('dark')).toBe(darkColors)
  expect(getColors('light')).toBe(lightColors)
  expect(getColors('unspecified')).toBe(lightColors)
})

test('control surface differs between light and dark', () => {
  expect(lightColors.controlSurface).toBe('#FFFFFF')
  expect(darkColors.controlSurface).toBe('#2D2D2D')
})

test('intensity colors are defined in both themes', () => {
  for (const c of [lightColors, darkColors]) {
    expect(c.intensityLow).toMatch(/^#/)
    expect(c.intensityMedium).toMatch(/^#/)
    expect(c.intensityHigh).toMatch(/^#/)
  }
})

test('onControlAccent matches surface in both themes', () => {
  expect(lightColors.onControlAccent).toBe(lightColors.surface)
  expect(darkColors.onControlAccent).toBe(darkColors.surface)
})

test('danger color is defined in both themes', () => {
  for (const c of [lightColors, darkColors]) {
    expect(c.danger).toMatch(/^#/)
  }
})
