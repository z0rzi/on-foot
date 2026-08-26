import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { useTheme } from '../theme/useTheme'
import { useRecordingStore } from './recordingStore'
import { usePreferencesStore } from '../settings/preferencesStore'
import { computeMetrics, formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { formatDuration, formatPace, formatSpeed } from '../activities/format'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'

export function RecordingInfoSheet({
  followedTrailName,
  animatedPosition,
}: {
  followedTrailName: string | null
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const session = useRecordingStore((s) => s.session)
  const points = useRecordingStore((s) => s.liveGeometry.points)
  const paceSpeedMode = usePreferencesStore((s) => s.paceSpeedMode)
  const togglePaceSpeed = usePreferencesStore((s) => s.togglePaceSpeed)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const durationSeconds = Math.max(0, (now - (session?.startedAt ?? now)) / 1000)
  const metrics = computeMetrics(points)

  const paceSpeedTile =
    paceSpeedMode === 'pace'
      ? { label: 'Pace (min/km)', value: formatPace(metrics.distanceMeters, durationSeconds) }
      : { label: 'Speed (km/h)', value: formatSpeed(metrics.distanceMeters, durationSeconds) }

  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <View style={styles.header}>
        <Text style={[styles.recording, { color: c.recordingLine }]}>● Recording</Text>
        {followedTrailName != null && (
          <Text style={[styles.following, { color: c.onSurfaceVariant }]} numberOfLines={1}>
            Following · {followedTrailName}
          </Text>
        )}
      </View>

      <MetricsGrid
        items={[
          { label: 'Duration', value: formatDuration(durationSeconds) },
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
  following: { fontSize: 13, flexShrink: 1 },
})
