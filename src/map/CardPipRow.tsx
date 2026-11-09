import { Pressable, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { PIP_HEIGHT, PIP_INSET } from './sheetHeader'

// The card's pip row, its pip 8 dp inside the card's top edge. Dragging it moves the card (it lies in
// the sheet's draggable content); a tap, or the accessibility action for a screen reader that cannot
// drag, toggles it. Over a graph its touch target reaches down over the graph's top, the row stacked
// above the graph so a tap there lands on it; a drag from there is still the graph's scrub or the
// card's, both native gestures that take the touch from a press.
export function CardPipRow({
  height,
  slop,
  open,
  onToggle,
}: {
  // The row's laid-out height, and how far its touch target reaches below it (`pipRow`).
  height: number
  slop: number
  open: boolean
  onToggle: () => void
}) {
  const c = useTheme()
  const label = open ? 'Show less' : 'Show more'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      accessibilityActions={[{ name: 'activate', label }]}
      onAccessibilityAction={onToggle}
      onPress={onToggle}
      hitSlop={{ bottom: slop }}
      style={[styles.row, { height }]}
    >
      <View style={[styles.indicator, { backgroundColor: c.onSurfaceVariant }]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', paddingTop: PIP_INSET, zIndex: 1 },
  indicator: { width: 36, height: PIP_HEIGHT, borderRadius: PIP_HEIGHT / 2 },
})
