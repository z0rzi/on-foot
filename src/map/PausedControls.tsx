import { useCallback } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { resumeRecording, linkTrailForSave } from '../recording/recordingController'
import { captureRefusalAlert } from '../recording/captureAlerts'
import { useMapStore } from '../store/mapStore'
import { ControlButton } from '../components/ControlButton'
import { PlayIcon } from '../assets/icons/play'
import { StopIcon } from '../assets/icons/stop'

export function PausedControls({ animatedBottom }: { animatedBottom?: SharedValue<number> }) {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const onResume = useCallback(async () => {
    try {
      const result = await resumeRecording()
      if (result !== 'resumed') {
        const { title, message } = captureRefusalAlert(result, 'resume')
        Alert.alert(title, message)
      }
    } catch {
      Alert.alert('Could not resume recording', 'Something went wrong. Please try again.')
    }
  }, [])

  const onStop = useCallback(async () => {
    try {
      const sel = useMapStore.getState().selection
      const linkedTrailId = sel?.kind === 'trail' ? sel.id : null
      await linkTrailForSave(linkedTrailId)
      router.push('/activity/save')
    } catch {
      Alert.alert('Could not stop recording', 'Something went wrong. Please try again.')
    }
  }, [router])

  const anchorStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding,
  }))

  return (
    <Animated.View style={[styles.anchor, { left: MapTokens.overlayPadding }, anchorStyle]}>
      <ControlButton accessibilityLabel="Resume recording" onPress={onResume}>
        <PlayIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
      </ControlButton>
      <ControlButton accessibilityLabel="Stop and save recording" onPress={onStop}>
        <StopIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
      </ControlButton>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', flexDirection: 'row', gap: 12 },
})
