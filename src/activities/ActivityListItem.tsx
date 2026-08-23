import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ActivitySummary } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { EffortBadge } from './EffortBadge'
import { formatActivityDate, formatActivitySummary } from './format'

export function ActivityListItem({
  activity,
  onSelect,
  onDelete,
}: {
  activity: ActivitySummary
  onSelect: (id: number) => void
  onDelete: (id: number) => void
}) {
  const c = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Pressable
        accessibilityLabel={`Show ${activity.name} on map`}
        onPress={() => onSelect(activity.id)}
        style={styles.body}
      >
        <View style={[styles.thumb, { backgroundColor: c.background }]}>
          <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.onSurface }]} numberOfLines={1}>{activity.name}</Text>
          <EffortBadge effort={activity.effort} />
          <Text style={[styles.meta, { color: c.onSurfaceVariant }]}>
            {formatActivitySummary(activity.metrics)}
          </Text>
          <Text style={[styles.meta, { color: c.onSurfaceVariant }]}>
            {formatActivityDate(activity.startedAt)}
          </Text>
        </View>
      </Pressable>
      <Pressable accessibilityLabel="Delete activity" onPress={() => onDelete(activity.id)} hitSlop={8} style={styles.action}>
        <Ionicons name="trash-outline" size={22} color={c.danger} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  action: { padding: 8, marginLeft: 4 },
})
