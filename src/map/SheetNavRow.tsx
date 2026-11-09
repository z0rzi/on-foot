import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Href } from 'expo-router'
import { useTheme } from '../theme/useTheme'

const BUTTON_HEIGHT = 56
// The bottom tab bar's icon size (React Navigation's default tab bar on a phone).
const ICON_SIZE = 25
const ROW_PADDING = 8
export const SHEET_NAV_ROW_HEIGHT = BUTTON_HEIGHT + ROW_PADDING * 2 + StyleSheet.hairlineWidth

const DESTINATIONS: { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href }[] = [
  { label: 'Trails', icon: 'list-outline', href: '/trails' },
  { label: 'Activities', icon: 'walk-outline', href: '/activities' },
  { label: 'Settings', icon: 'settings-outline', href: '/settings' },
]

// Under the details in the open card, the row has a divider; it has no surface of its own, so the
// card's shows through it at every height. The nav card has nothing above the row: its divider stays
// transparent so the row keeps its height.
export function SheetNavRow({ underDetails, onNavigate }: { underDetails: boolean; onNavigate: (href: Href) => void }) {
  const c = useTheme()
  return (
    <View style={[styles.row, { borderTopColor: underDetails ? c.panelDivider : 'transparent' }]}>
      {DESTINATIONS.map((d) => (
        <Pressable key={d.label} accessibilityRole="button" onPress={() => onNavigate(d.href)} style={styles.button}>
          <Ionicons name={d.icon} size={ICON_SIZE} color={c.panelContent} />
          <Text style={[styles.label, { color: c.panelContent }]} numberOfLines={1}>{d.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: ROW_PADDING,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: { flex: 1, height: BUTTON_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 12, fontWeight: '600' },
})
