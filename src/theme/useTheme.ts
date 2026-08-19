import { useColorScheme } from 'react-native'
import { getColors, AppColors } from './colors'

export function useTheme(): AppColors {
  const scheme = useColorScheme() ?? null
  return getColors(scheme === 'unspecified' ? null : scheme)
}
