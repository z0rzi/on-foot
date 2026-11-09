import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { usePreferencesStore } from '../settings/preferencesStore'
import { groupPointsBySegment } from '../data/activities/mapping'
import { metricsForSegments } from '../data/geo/metrics'
import { useRecordingStore } from './recordingStore'
import { useMovingStopwatch } from './useMovingStopwatch'
import { currentPace } from './currentPace'
import { recordingFigures } from './recordingFigures'

const FIGURE_SIZE = 21
const FIGURE_MIN_SIZE = 16

// The running recording's four figures, in a row. Frozen while paused: the stopwatch stops and no
// point arrives, so every figure holds still.
export function RecordingFigures() {
  const c = useTheme()
  const session = useRecordingStore((s) => s.session)
  const livePoints = useRecordingStore((s) => s.livePoints)
  const paceSpeedMode = usePreferencesStore((s) => s.paceSpeedMode)
  const togglePaceSpeed = usePreferencesStore((s) => s.togglePaceSpeed)
  const movingSeconds = useMovingStopwatch(session) / 1000
  // The stopwatch re-renders every second; the track is measured only when it grows.
  const segments = useMemo(() => groupPointsBySegment(livePoints), [livePoints])
  const metrics = useMemo(() => metricsForSegments(segments), [segments])
  const pace = useMemo(() => currentPace(segments), [segments])
  const [time, distance, paceFigure, gain] = recordingFigures({
    movingSeconds,
    distanceMeters: metrics.distanceMeters,
    gainMeters: metrics.elevationGainMeters,
    pace,
    paceSpeedMode,
  })
  const figure = (f: { value: string; label: string }) => (
    <>
      <Text
        style={[styles.value, { color: c.onSurface }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={FIGURE_MIN_SIZE / FIGURE_SIZE}
      >
        {f.value}
      </Text>
      <Text style={[styles.label, { color: c.onSurfaceVariant }]} numberOfLines={1}>{f.label}</Text>
    </>
  )
  return (
    <View style={styles.figures}>
      <View style={styles.column}>{figure(time)}</View>
      <View style={styles.column}>{figure(distance)}</View>
      <Pressable
        style={styles.column}
        accessibilityRole="button"
        accessibilityLabel="Switch between pace and speed"
        onPress={togglePaceSpeed}
      >
        {figure(paceFigure)}
      </Pressable>
      <View style={styles.column}>{figure(gain)}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  figures: { flexDirection: 'row' },
  column: { flex: 1, alignItems: 'center' },
  value: { fontSize: FIGURE_SIZE, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { fontSize: 12 },
})
