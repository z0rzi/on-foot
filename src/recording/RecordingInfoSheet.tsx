import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/useTheme'
import { useRecordingStore, recordingPhase } from './recordingStore'
import { usePreferencesStore } from '../settings/preferencesStore'
import { metricsForSegments, formatDistance, formatElevation } from '../data/geo/metrics'
import { groupPointsBySegment } from '../data/activities/mapping'
import { formatPace, formatSpeed, formatStopwatch } from '../activities/format'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../components/MetricsGrid'
import { ElevationGraph } from '../elevation/ElevationGraph'
import type { ElevationProfile } from '../elevation/profile'
import { useMovingStopwatch } from './useMovingStopwatch'
import { ensureStreaming } from './recordingController'
import { recordingHealthFor, recordingStatusText } from './streamHealth'

export function RecordingInfoSheet({
  followedTrailName,
  profile,
  onRemoveTrail,
  animatedPosition,
}: {
  followedTrailName: string | null
  profile: ElevationProfile | null
  onRemoveTrail: () => void
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const session = useRecordingStore((s) => s.session)
  const livePoints = useRecordingStore((s) => s.livePoints)
  const locationAvailable = useRecordingStore((s) => s.locationAvailable)
  const captureFault = useRecordingStore((s) => s.captureFault)
  const paceSpeedMode = usePreferencesStore((s) => s.paceSpeedMode)
  const togglePaceSpeed = usePreferencesStore((s) => s.togglePaceSpeed)

  const phase = recordingPhase(session)
  const health = recordingHealthFor({ phase, locationAvailable, captureFault })
  const status = recordingStatusText(phase, health)
  const durationSeconds = useMovingStopwatch(session) / 1000
  // useMovingStopwatch re-renders this sheet every second, so without the memo a long recording
  // re-measures its whole track — haversine plus elevation smoothing — once per tick.
  const metrics = useMemo(() => metricsForSegments(groupPointsBySegment(livePoints)), [livePoints])

  const paceSpeedTile =
    paceSpeedMode === 'pace'
      ? { label: 'Pace (min/km)', value: formatPace(metrics.distanceMeters, durationSeconds) }
      : { label: 'Speed (km/h)', value: formatSpeed(metrics.distanceMeters, durationSeconds) }

  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <View style={styles.header}>
        <Text style={[styles.recording, { color: c.recordingLine }]}>{status.title}</Text>
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

      {(status.detail != null || health.kind === 'not-capturing') && (
        <View style={styles.fault}>
          {status.detail != null && (
            <Text style={[styles.faultText, { color: c.onSurfaceVariant }]}>{status.detail}</Text>
          )}
          {health.kind === 'not-capturing' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry location capture"
              onPress={() => {
                ensureStreaming().catch(() => {
                  // The fault stays shown; the next tap or return to the app retries.
                })
              }}
              style={[styles.retry, { backgroundColor: c.controlAccent }]}
            >
              <Text style={[styles.retryLabel, { color: c.onControlAccent }]}>Retry</Text>
            </Pressable>
          )}
        </View>
      )}

      {profile && <ElevationGraph profile={profile} placement="inSheet" />}

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
  fault: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  faultText: { fontSize: 13, flexShrink: 1 },
  retry: { borderRadius: 12, paddingVertical: 6, paddingHorizontal: 14 },
  retryLabel: { fontSize: 14, fontWeight: '700' },
})
