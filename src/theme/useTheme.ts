import { useColorScheme } from 'react-native'
import { getColors, AppColors } from './colors'

export function useTheme(): AppColors {
  return getColors(useColorScheme() === 'dark' ? 'dark' : null)
}
