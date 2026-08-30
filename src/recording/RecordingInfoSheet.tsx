import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/useTheme'
import { useRecordingStore, recordingPhase } from './recordingStore'
import { usePreferencesStore } from '../settings/preferencesStore'
import { computeMetrics, formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { formatPace, formatSpeed, formatStopwatch } from '../activities/format'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'
import { movingElapsedMs } from './session'

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
  const points = useRecordingStore((s) => s.liveGeometry.points)
  const paceSpeedMode = usePreferencesStore((s) => s.paceSpeedMode)
  const togglePaceSpeed = usePreferencesStore((s) => s.togglePaceSpeed)

  const phase = recordingPhase(session)

  const [now, setNow] = useState(() => Date.now())
  const [prevPhase, setPrevPhase] = useState(phase)
  // Refresh the clock the instant recording (re)starts, before paint, so the first frame after a
  // resume already reflects the new pausedMs instead of briefly showing the pre-resume value.
  if (phase !== prevPhase) {
    setPrevPhase(phase)
    if (phase === 'recording') setNow(Date.now())
  }
  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])

  const durationSeconds = session ? movingElapsedMs(session, now) / 1000 : 0
  const metrics = computeMetrics(points)

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
