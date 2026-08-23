import React, { useCallback, useMemo } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { startRecording, stopRecording } from '../recording/recordingController'
import { useMapStore } from '../store/mapStore'
import { PlayIcon } from '../assets/icons/play'
import { StopIcon } from '../assets/icons/stop'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SIZE = MapTokens.controlSize
const RING = MapTokens.recordRingWidth
const R = (SIZE - RING) / 2
const CENTER = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export function RecordButton({ extraBottom = 0 }: { extraBottom?: number }) {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phase = useRecordingStore((s) => recordingPhase(s.session))
  const progress = useSharedValue(0)

  const onPlay = useCallback(async () => {
    try {
      const result = await startRecording()
      if (result === 'permission-denied') {
        Alert.alert(
          'Location permission needed',
          'To record your activity while the app is in the background, allow location access "All the time".',
        )
      } else if (result === 'already-active') {
        router.push('/activity/save')
      }
    } catch {
      Alert.alert('Could not start recording', 'Something went wrong. Please try again.')
    }
  }, [router])

  const doStop = useCallback(async () => {
    try {
      const sel = useMapStore.getState().selection
      const linkedTrailId = sel?.kind === 'trail' ? sel.id : null
      await stopRecording(linkedTrailId)
      router.push('/activity/save')
    } catch {
      Alert.alert('Could not stop recording', 'Something went wrong. Please try again.')
    }
  }, [router])

  const hold = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(MapTokens.holdToStopMs)
        .onBegin(() => {
          progress.value = withTiming(1, { duration: MapTokens.holdToStopMs })
        })
        .onStart(() => {
          runOnJS(doStop)()
        })
        .onFinalize(() => {
          progress.value = withTiming(0, { duration: 150 })
        }),
    [doStop, progress],
  )

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  if (phase === 'saving') return null

  return (
    <View style={[styles.anchor, { bottom: insets.bottom + MapTokens.overlayPadding + extraBottom, left: MapTokens.overlayPadding }]}>
      {phase === 'recording' ? (
        <GestureDetector gesture={hold}>
          <View
            accessibilityLabel="Stop recording (press and hold)"
            style={[styles.btn, { backgroundColor: c.controlSurface }]}
          >
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
              <AnimatedCircle
                cx={CENTER}
                cy={CENTER}
                r={R}
                stroke={c.recordingLine}
                strokeWidth={RING}
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={ringProps}
                strokeLinecap="round"
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              />
            </Svg>
            <StopIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
          </View>
        </GestureDetector>
      ) : (
        <Pressable
          accessibilityLabel="Start recording"
          onPress={onPlay}
          style={[styles.btn, { backgroundColor: c.controlSurface }]}
        >
          <PlayIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute' },
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
