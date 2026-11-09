import { Pressable, StyleSheet, Text } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { useReturnToMap } from '../components/useReturnToMap'
import { recordingPhase } from './recordingPhase'
import { useRecordingStore } from './recordingStore'
import { useMovingStopwatch } from './useMovingStopwatch'
import { recordingBannerText } from './recordingBanner'

export function RecordingBanner() {
  const c = useTheme()
  const session = useRecordingStore((s) => s.session)
  const elapsedMs = useMovingStopwatch(session)
  const returnToMap = useReturnToMap()
  const text = recordingBannerText(recordingPhase(session), elapsedMs / 1000)
  if (text == null) return null

  return (
    <Pressable
      accessibilityLabel="Recording in progress, back to the map"
      accessibilityRole="button"
      onPress={returnToMap}
      style={[styles.bar, { backgroundColor: c.recordingLine }]}
    >
      <Text style={[styles.status, { color: c.onRecording }]} numberOfLines={1}>
        {text}
      </Text>
      <Text style={[styles.action, { color: c.onRecording }]}>Back to map ›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  status: { flex: 1, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  action: { fontSize: 15, fontWeight: '600' },
})
