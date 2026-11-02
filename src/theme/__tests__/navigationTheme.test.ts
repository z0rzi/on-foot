import { DefaultTheme } from 'expo-router'
import { darkColors, lightColors } from '../colors'
import { getNavigationTheme } from '../navigationTheme'

test.each([
  ['light', false, lightColors],
  ['dark', true, darkColors],
] as const)('the %s navigation theme is built from the app colours', (scheme, dark, colors) => {
  expect(getNavigationTheme(scheme)).toEqual({
    dark,
    colors: {
      primary: colors.controlAccent,
      background: colors.background,
      card: colors.surface,
      text: colors.onSurface,
      border: colors.panelDivider,
      notification: colors.danger,
    },
    fonts: DefaultTheme.fonts,
  })
})

test('an unknown scheme falls back to the light navigation theme', () => {
  expect(getNavigationTheme('unspecified')).toEqual(getNavigationTheme('light'))
})
