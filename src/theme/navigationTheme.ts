import type { ColorSchemeName } from 'react-native'
import { DefaultTheme, type Theme } from 'expo-router'
import { getColors } from './colors'

export function getNavigationTheme(scheme: ColorSchemeName): Theme {
  const colors = getColors(scheme)
  return {
    dark: scheme === 'dark',
    colors: {
      primary: colors.controlAccent,
      background: colors.background,
      card: colors.surface,
      text: colors.onSurface,
      border: colors.panelDivider,
      notification: colors.danger,
    },
    fonts: DefaultTheme.fonts,
  }
}
