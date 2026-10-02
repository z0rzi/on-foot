import React, { useCallback, useMemo, useRef } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { startRecording, pauseRecording } from '../recording/recordingController'
import { captureRefusalAlert } from '../recording/captureAlerts'
import { showToast } from '../components/toast'
import { ControlButton, controlSurfaceStyle } from '../components/ControlButton'
import { PlayIcon } from '../assets/icons/play'
import { PauseIcon } from '../assets/icons/pause'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SIZE = MapTokens.controlSize
const RING = MapTokens.recordRingWidth
const R = (SIZE - RING) / 2
const CENTER = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * R
// The button stays small (discreet) but takes touches from a larger area, and jumps larger while
// pressed so the press registers visibly past the thumb covering it (the ring shows hold progress).
const HITSLOP = 10
const HOLD_SCALE = 0.25

export function RecordButton({ animatedBottom }: { animatedBottom?: SharedValue<number> }) {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phase = useRecordingStore((s) => recordingPhase(s.session))
  const resumeSettled = useRecordingStore((s) => s.resumeSettled)
  const progress = useSharedValue(0)
  const pressScale = useSharedValue(0)
  const pausedRef = useRef(false)

  const onPlay = useCallback(async () => {
    try {
      const result = await startRecording()
      if (result === 'already-active') {
        router.push('/activity/save')
      } else if (result !== 'started') {
        const { title, message } = captureRefusalAlert(result, 'start')
        Alert.alert(title, message)
      }
    } catch {
      Alert.alert('Could not start recording', 'Something went wrong. Please try again.')
    }
  }, [router])

  const doPause = useCallback(async () => {
    pausedRef.current = true
    try {
      await pauseRecording()
    } catch {
      Alert.alert('Could not pause recording', 'Something went wrong. Please try again.')
    }
  }, [])

  // A press that ends before the hold completes never paused — hint that pausing needs a hold.
  const onRelease = useCallback(() => {
    if (!pausedRef.current) showToast('Hold to pause')
    pausedRef.current = false
  }, [])

  /* eslint-disable react-hooks/immutability, react-hooks/refs -- pressScale/progress shared values
     and pausedRef (via doPause/onRelease) are mutated/read only inside the deferred gesture
     callbacks, which run at gesture time, never during render. Idiomatic reanimated + RNGH
     useMemo pattern; the compiler can't see the deferral through the builder. */
  const hold = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(MapTokens.holdToStopMs)
        .hitSlop(HITSLOP)
        .onBegin(() => {
          pressScale.value = withTiming(1, { duration: 120 })
          progress.value = withTiming(1, { duration: MapTokens.holdToStopMs })
        })
        .onStart(() => {
          runOnJS(doPause)()
        })
        .onFinalize(() => {
          pressScale.value = withTiming(0, { duration: 150 })
          progress.value = withTiming(0, { duration: 150 })
          runOnJS(onRelease)()
        }),
    [doPause, onRelease, progress, pressScale],
  )
  /* eslint-enable react-hooks/immutability, react-hooks/refs */

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  const anchorStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding,
  }))

  const holdScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pressScale.value * HOLD_SCALE }],
  }))

  // Until launch handling settles, a recording may exist that the store has not loaded; Record would
  // open the save screen over it.
  if (!resumeSettled) return null

  return (
    <Animated.View style={[styles.anchor, { left: MapTokens.overlayPadding }, anchorStyle]}>
      {phase === 'recording' ? (
        <GestureDetector gesture={hold}>
          <Animated.View
            accessibilityLabel="Pause recording (press and hold)"
            style={[controlSurfaceStyle, { backgroundColor: c.controlSurface }, holdScaleStyle]}
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
            <PauseIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
          </Animated.View>
        </GestureDetector>
      ) : (
        <ControlButton accessibilityLabel="Start recording" onPress={onPlay}>
          <PlayIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
        </ControlButton>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute' },
})
