import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { AccentButton } from '../components/AccentButton'
import { ensureStreaming } from './recordingController'
import type { RecordingWarning } from './streamHealth'

// What is wrong with the recording's location capture, with a retry when one can help.
export function RecordingWarningLine({ warning }: { warning: RecordingWarning }) {
  const c = useTheme()
  return (
    <View style={styles.warning}>
      <Text style={[styles.warningText, { color: c.warning }]}>{warning.text}</Text>
      {warning.retry && (
        <AccentButton
          label="Retry"
          accessibilityLabel="Retry location capture"
          onPress={() => {
            ensureStreaming().catch(() => {
              // The line stays shown; the next tap or return to the app retries.
            })
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  warning: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  warningText: { fontSize: 13, flexShrink: 1 },
})
