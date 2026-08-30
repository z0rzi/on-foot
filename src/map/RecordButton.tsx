import React, { useCallback, useEffect, useMemo } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { startRecording, pauseRecording } from '../recording/recordingController'
import { PlayIcon } from '../assets/icons/play'
import { PauseIcon } from '../assets/icons/pause'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SIZE = MapTokens.controlSize
const RING = MapTokens.recordRingWidth
const R = (SIZE - RING) / 2
const CENTER = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export function RecordButton({ animatedBottom }: { animatedBottom?: SharedValue<number> }) {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phase = useRecordingStore((s) => recordingPhase(s.session))
  const progress = useSharedValue(0)

  // Stopping navigates to the save screen mid-gesture, so the hold's onFinalize (which clears the
  // ring) never fires. Reset on every phase change so a new recording never inherits a filled ring.
  useEffect(() => {
    progress.value = 0
  }, [phase, progress])

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

  const doPause = useCallback(async () => {
    try {
      await pauseRecording()
    } catch {
      Alert.alert('Could not pause recording', 'Something went wrong. Please try again.')
    }
  }, [])

  const hold = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(MapTokens.holdToStopMs)
        .onBegin(() => {
          progress.value = withTiming(1, { duration: MapTokens.holdToStopMs })
        })
        .onStart(() => {
          runOnJS(doPause)()
        })
        .onFinalize(() => {
          progress.value = withTiming(0, { duration: 150 })
        }),
    [doPause, progress],
  )

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  const anchorStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding,
  }))

  if (phase === 'paused') return null

  return (
    <Animated.View style={[styles.anchor, { left: MapTokens.overlayPadding }, anchorStyle]}>
      {phase === 'recording' ? (
        <GestureDetector gesture={hold}>
          <View
            accessibilityLabel="Pause recording (press and hold)"
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
            <PauseIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
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
    </Animated.View>
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
