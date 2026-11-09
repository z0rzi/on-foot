import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useBottomSheet, useBottomSheetInternal } from '@gorhom/bottom-sheet'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { cardSurfaces } from './cardSurface'
import { sheetHeightAbove } from './overlayGeometry'
import { SHEET_COLLAPSED, SHEET_OPEN } from './sheetIndex'

const CARD_RADIUS = 16

// The map card as seen, rendered as the sheet's child: the part of gorhom's sheet above its container's
// bottom, the card's bottom edge in detached mode. A detached sheet's body is as tall as the open snap
// point and hangs unclipped below that edge, so the card's surface, clip and footer live here instead.
// The footer is pinned to the frame's bottom, the edge the details end above, rather than in gorhom's
// footer slot, which lies outside this clip.
export function CardFrame({
  animatedIndex,
  footer,
  children,
}: {
  animatedIndex: SharedValue<number>
  footer: ReactNode
  children: ReactNode
}) {
  const c = useTheme()
  const { animatedPosition } = useBottomSheet()
  // The container height has no public read: @gorhom/bottom-sheet 5.2.14's internal context.
  const { animatedLayoutState } = useBottomSheetInternal()
  const { collapsed, open } = cardSurfaces(c)
  const frameStyle = useAnimatedStyle(() => ({
    height: sheetHeightAbove(animatedLayoutState.get().containerHeight, animatedPosition.get()),
    backgroundColor: interpolateColor(animatedIndex.get(), [SHEET_COLLAPSED, SHEET_OPEN], [collapsed, open]),
  }))
  return (
    <Animated.View style={[styles.frame, frameStyle]}>
      <View style={styles.clip}>
        {children}
        <View style={styles.footer}>{footer}</View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  frame: { borderRadius: CARD_RADIUS, boxShadow: MapTokens.floatingShadow },
  // A separate view, so the clipping never touches the frame that casts the shadow.
  clip: { flex: 1, borderRadius: CARD_RADIUS, overflow: 'hidden' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
})
