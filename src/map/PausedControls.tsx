import { useCallback } from 'react'
import { Alert, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { resumeRecording, stopToSave } from '../recording/recordingController'
import { useMapStore } from '../store/mapStore'
import { PlayIcon } from '../assets/icons/play'
import { StopIcon } from '../assets/icons/stop'

const SIZE = MapTokens.controlSize

export function PausedControls({ animatedBottom }: { animatedBottom?: SharedValue<number> }) {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const onResume = useCallback(async () => {
    try {
      await resumeRecording()
    } catch {
      Alert.alert('Could not resume recording', 'Something went wrong. Please try again.')
    }
  }, [])

  const onStop = useCallback(async () => {
    try {
      const sel = useMapStore.getState().selection
      const linkedTrailId = sel?.kind === 'trail' ? sel.id : null
      await stopToSave(linkedTrailId)
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
      <Pressable
        accessibilityLabel="Resume recording"
        onPress={onResume}
        style={[styles.btn, { backgroundColor: c.controlSurface }]}
      >
        <PlayIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
      </Pressable>
      <Pressable
        accessibilityLabel="Stop and save recording"
        onPress={onStop}
        style={[styles.btn, { backgroundColor: c.controlSurface }]}
      >
        <StopIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', flexDirection: 'row', gap: 12 },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
})
