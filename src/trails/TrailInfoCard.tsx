import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Trail } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'

export function TrailInfoCard({ trail, onClose }: { trail: Trail; onClose: () => void }) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.container, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: c.panelBackground }]}>
        <View style={[styles.thumb, { backgroundColor: c.background }]}>
          <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{trail.name}</Text>
          <DifficultyBadge difficulty={trail.difficulty} />
          <Text style={[styles.metrics, { color: c.onSurfaceVariant }]}>
            {formatDistance(trail.metrics.distanceMeters)} • {formatElevation(trail.metrics.elevationGainMeters)} gain
          </Text>
        </View>
        <Pressable accessibilityLabel="Close trail info" onPress={onClose} hitSlop={8} style={styles.close}>
          <Ionicons name="close" size={22} color={c.panelContent} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16, elevation: 8 },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' },
  metrics: { fontSize: 13 },
  close: { padding: 8 },
})
