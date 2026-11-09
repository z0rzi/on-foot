import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

// One of the Map's overlays that hide while the sheet is pulled up past half the screen: invisible,
// untouchable and out of the accessibility tree, but still laid out, so nothing moves as it returns.
export function HideableOverlay({
  hidden,
  style,
  children,
}: {
  hidden: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  return (
    <View
      style={[style, { opacity: hidden ? 0 : 1 }]}
      pointerEvents={hidden ? 'none' : 'box-none'}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      {children}
    </View>
  )
}
