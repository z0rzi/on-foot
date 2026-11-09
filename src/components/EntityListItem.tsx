import { Ionicons } from '@expo/vector-icons'
import { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import type { MenuAnchor } from './ActionsMenu'
import { ActionsMenuButton } from './ActionsMenuButton'

export function EntityListItem({
  title,
  summary,
  onPress,
  pressAccessibilityLabel,
  actions,
}: {
  title: string
  // Under the title: the entity's badge and summary lines, as EntitySummary draws them.
  summary: ReactNode
  onPress: () => void
  pressAccessibilityLabel: string
  actions: { accessibilityLabel: string; onOpen: (anchor: MenuAnchor) => void }
}) {
  const c = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Pressable accessibilityLabel={pressAccessibilityLabel} onPress={onPress} style={styles.body}>
        <View style={[styles.thumb, { backgroundColor: c.background }]}>
          <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.onSurface }]} numberOfLines={2}>{title}</Text>
          {summary}
        </View>
      </Pressable>
      <ActionsMenuButton accessibilityLabel={actions.accessibilityLabel} onOpen={actions.onOpen} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' },
})
