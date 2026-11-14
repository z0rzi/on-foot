import { useCallback } from 'react'
import { Alert, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { resumeRecording, linkTrailForSave } from '../recording/recordingController'
import { captureRefusalAlert } from '../recording/captureAlerts'
import { currentAlongTrailId } from '../recording/currentAlongTrail'
import { errorClass, logEvent } from '../log'
import { ControlButton } from '../components/ControlButton'
import { PlayIcon } from '../assets/icons/play'
import { StopIcon } from '../assets/icons/stop'

export function PausedControls({ animatedBottom }: { animatedBottom: SharedValue<number> }) {
  const c = useTheme()
  const router = useRouter()

  const onResume = useCallback(async () => {
    try {
      const result = await resumeRecording()
      if (result !== 'resumed') {
        const { title, message } = captureRefusalAlert(result, 'resume')
        Alert.alert(title, message)
      }
    } catch (error) {
      logEvent('error', 'error', 'resume recording threw', { errorClass: errorClass(error) })
      Alert.alert('Could not resume recording', 'Something went wrong. Please try again.')
    }
  }, [])

  const onStop = useCallback(async () => {
    try {
      await linkTrailForSave(currentAlongTrailId())
      router.push('/activity/save')
    } catch (error) {
      logEvent('error', 'error', 'stop recording threw', { errorClass: errorClass(error) })
      Alert.alert('Could not stop recording', 'Something went wrong. Please try again.')
    }
  }, [router])

  const anchorStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom.value,
  }))

  return (
    <Animated.View style={[styles.anchor, { left: MapTokens.overlayPadding }, anchorStyle]}>
      <ControlButton accessibilityLabel="Resume recording" onPress={onResume} size={MapTokens.recordButtonSize}>
        <PlayIcon size={MapTokens.recordIconSize} color={c.recordingLine} />
      </ControlButton>
      <ControlButton accessibilityLabel="Stop and save recording" onPress={onStop} size={MapTokens.recordButtonSize}>
        <StopIcon size={MapTokens.recordIconSize} color={c.recordingLine} />
      </ControlButton>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', flexDirection: 'row', gap: 12 },
})
