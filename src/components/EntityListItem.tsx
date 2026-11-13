import { Ionicons } from '@expo/vector-icons'
import { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import type { MenuAnchor } from './ActionsMenu'
import { ActionsMenuButton } from './ActionsMenuButton'

// `card` is a list screen's row; `compact` is a row inside a panel (a card's list), outlined
// rather than filled, with no thumbnail, the selected one outlined in the accent.
export function EntityListItem({
  title,
  summary,
  onPress,
  pressAccessibilityLabel,
  actions,
  variant = 'card',
  selected = false,
}: {
  title: string
  // Under the title: the entity's badge and summary lines, as EntitySummary draws them.
  summary: ReactNode
  onPress: () => void
  pressAccessibilityLabel: string
  actions?: { accessibilityLabel: string; onOpen: (anchor: MenuAnchor) => void }
  variant?: 'card' | 'compact'
  selected?: boolean
}) {
  const c = useTheme()
  const compact = variant === 'compact'
  return (
    <View
      style={
        compact
          ? [styles.compact, { borderColor: selected ? c.controlAccent : c.panelDivider }]
          : [styles.card, { backgroundColor: c.surface }]
      }
    >
      <Pressable
        accessibilityLabel={pressAccessibilityLabel}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={styles.body}
      >
        {!compact && (
          <View style={[styles.thumb, { backgroundColor: c.background }]}>
            <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
          </View>
        )}
        <View style={[styles.info, !compact && styles.besideThumb]}>
          <Text
            style={compact ? [styles.compactName, { color: c.panelContent }] : [styles.name, { color: c.onSurface }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {summary}
        </View>
      </Pressable>
      {actions && <ActionsMenuButton accessibilityLabel={actions.accessibilityLabel} onOpen={actions.onOpen} />}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16 },
  compact: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 10, borderWidth: 1 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4 },
  besideThumb: { marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '700' },
  compactName: { fontSize: 14, fontWeight: '600' },
})
