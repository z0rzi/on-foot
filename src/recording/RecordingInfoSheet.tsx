import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/useTheme'
import { useRecordingStore, recordingPhase } from './recordingStore'
import { usePreferencesStore } from '../settings/preferencesStore'
import { metricsForSegments, formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { groupPointsBySegment } from '../data/activities/mapping'
import { formatPace, formatSpeed, formatStopwatch } from '../activities/format'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'
import { useMovingStopwatch } from './useMovingStopwatch'

export function RecordingInfoSheet({
  followedTrailName,
  onRemoveTrail,
  animatedPosition,
}: {
  followedTrailName: string | null
  onRemoveTrail: () => void
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const session = useRecordingStore((s) => s.session)
  const livePoints = useRecordingStore((s) => s.livePoints)
  const paceSpeedMode = usePreferencesStore((s) => s.paceSpeedMode)
  const togglePaceSpeed = usePreferencesStore((s) => s.togglePaceSpeed)

  const phase = recordingPhase(session)
  const durationSeconds = useMovingStopwatch(session) / 1000
  const metrics = metricsForSegments(groupPointsBySegment(livePoints))

  const paceSpeedTile =
    paceSpeedMode === 'pace'
      ? { label: 'Pace (min/km)', value: formatPace(metrics.distanceMeters, durationSeconds) }
      : { label: 'Speed (km/h)', value: formatSpeed(metrics.distanceMeters, durationSeconds) }

  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <View style={styles.header}>
        <Text style={[styles.recording, { color: c.recordingLine }]}>
          {phase === 'paused' ? '⏸ Paused' : '● Recording'}
        </Text>
        {followedTrailName != null && (
          <Pressable
            onPress={onRemoveTrail}
            accessibilityLabel="Stop following trail"
            hitSlop={8}
            style={styles.following}
          >
            <Text style={[styles.followingText, { color: c.onSurfaceVariant }]} numberOfLines={1}>
              Following · {followedTrailName}
            </Text>
            <Ionicons name="close" size={14} color={c.onSurfaceVariant} />
          </Pressable>
        )}
      </View>

      <MetricsGrid
        items={[
          { label: 'Duration', value: formatStopwatch(durationSeconds) },
          { label: 'Distance', value: formatDistance(metrics.distanceMeters) },
          { label: 'Elev. Gain', value: formatElevation(metrics.elevationGainMeters) },
          { ...paceSpeedTile, onPress: togglePaceSpeed, accessibilityLabel: 'Toggle pace or speed' },
        ]}
      />
    </MapInfoSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  recording: { fontSize: 16, fontWeight: '700' },
  following: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  followingText: { fontSize: 13, flexShrink: 1 },
})
