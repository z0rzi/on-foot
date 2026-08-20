import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { TrailSummary } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'

export function TrailListItem({ trail, onDelete }: { trail: TrailSummary; onDelete: (id: number) => void }) {
  const c = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={[styles.thumb, { backgroundColor: c.background }]}>
        <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: c.onSurface }]} numberOfLines={1}>{trail.name}</Text>
        <DifficultyBadge difficulty={trail.difficulty} />
        <Text style={[styles.metrics, { color: c.onSurfaceVariant }]}>
          {formatDistance(trail.metrics.distanceMeters)} • {formatElevation(trail.metrics.elevationGainMeters)} gain
        </Text>
      </View>
      <Pressable accessibilityLabel="Delete trail" onPress={() => onDelete(trail.id)} hitSlop={8} style={styles.delete}>
        <Ionicons name="trash-outline" size={22} color={c.danger} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16 },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' },
  metrics: { fontSize: 13 },
  delete: { padding: 8 },
})
