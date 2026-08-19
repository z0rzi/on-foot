import React, { useMemo, useRef } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { ControlButton } from '../components/ControlButton'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useMapCapabilities } from './provider'
import { useMapStore, nextPitchOnToggle, clampPitch } from '../store/mapStore'
import { NorthIcon } from '../assets/icons/north'
import { LayersIcon } from '../assets/icons/layers'
import { PositionIcon } from '../assets/icons/position'
import { PositionFollowIcon } from '../assets/icons/position-follow'

export function MapControls({
  onOpenLayers,
  setPitch,
}: {
  onOpenLayers: () => void
  // Imperative camera pitch setter lifted from MapScreen (see MapScreen.tsx / MapCanvas.tsx).
  // Keeps this component free of any map-SDK import — it only ever talks to the port's
  // CameraHandle through this callback plus the Zustand store for the "last known" pitch.
  setPitch: (pitch: number, animated: boolean) => void
}) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const caps = useMapCapabilities()
  const followMode = useMapStore((s) => s.followMode)
  const cycleFollowMode = useMapStore((s) => s.cycleFollowMode)
  const cameraPitch = useMapStore((s) => s.cameraPitch)
  const setCameraPitch = useMapStore((s) => s.setCameraPitch)
  const disableFollow = useMapStore((s) => s.disableFollow)

  // Heading tracking is Phase 2 — the tracked heading is hardcoded to 0 for now,
  // so the North button stays hidden until Phase 2 wires up real bearing.
  const heading = 0
  const following = followMode !== 'off'
  const LocationIcon = followMode === 'positionAndBearing' ? PositionFollowIcon : PositionIcon

  const is3DMode = cameraPitch > MapTokens.pitchMin
  // Seeded on drag start with the pitch at that moment; translationY from gesture-handler is
  // cumulative from gesture start, so the live target is simply seed + (-translationY)*sensitivity.
  const dragSeed = useRef(0)

  const handleToggle = () => {
    disableFollow()
    const next = nextPitchOnToggle(cameraPitch)
    setCameraPitch(next)
    setPitch(next, true)
  }

  // Memoized so the gesture object's identity is stable across renders — MapStore's
  // setCameraPitch triggers a re-render on every drag frame (`.onUpdate` below), and a fresh
  // Gesture.Pan() per render makes RNGH re-run its native `updateGestureHandler` bridge call on
  // every frame (RNGH docs: "Gesture config should be wrapped with useMemo"). `cameraPitch` is
  // deliberately NOT a dep — it changes every frame too, which would defeat the memo — so
  // `.onBegin` reads the live pitch imperatively from the store instead of closing over it.
  // `disableFollow`/`setCameraPitch` are Zustand actions (stable by default) and `setPitch` is
  // `useCallback`'d with `[]` deps in MapScreen, so the empty dep array below is safe.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          disableFollow()
          dragSeed.current = useMapStore.getState().cameraPitch
        })
        .onUpdate((e) => {
          const next = clampPitch(dragSeed.current - e.translationY * MapTokens.pitchSensitivity)
          setCameraPitch(next)
          setPitch(next, false)
        })
        .runOnJS(true),
    [disableFollow, setCameraPitch, setPitch],
  )

  return (
    <View
      style={[
        styles.col,
        { bottom: insets.bottom + MapTokens.overlayPadding, right: MapTokens.overlayPadding },
      ]}
    >
      {heading !== 0 && (
        <ControlButton accessibilityLabel="Reset north" onPress={() => {}}>
          <NorthIcon size={MapTokens.controlIconSize} color={c.controlContent} />
        </ControlButton>
      )}
      {caps.supportsTerrain && (
        <GestureDetector gesture={pan}>
          <ControlButton
            accessibilityLabel={is3DMode ? 'Switch to 2D view' : 'Switch to 3D view'}
            onPress={handleToggle}
          >
            <Text style={{ color: c.controlsText, fontWeight: 'bold', fontSize: 11 }}>
              {is3DMode ? '2D' : '3D'}
            </Text>
          </ControlButton>
        </GestureDetector>
      )}
      <ControlButton accessibilityLabel="Open map layers" onPress={onOpenLayers}>
        <LayersIcon size={MapTokens.controlIconSize} color={c.controlContent} />
      </ControlButton>
      <ControlButton accessibilityLabel="Center on your location" onPress={cycleFollowMode}>
        <LocationIcon size={MapTokens.controlIconSize} color={following ? c.controlAccent : c.controlContent} />
      </ControlButton>
    </View>
  )
}

const styles = StyleSheet.create({
  col: { position: 'absolute', gap: MapTokens.controlsSpacing, alignItems: 'flex-end' },
})
