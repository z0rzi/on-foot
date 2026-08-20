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

export function MapControls({ onOpenLayers }: { onOpenLayers: () => void }) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const caps = useMapCapabilities()
  const followMode = useMapStore((s) => s.followMode)
  const cycleFollowMode = useMapStore((s) => s.cycleFollowMode)
  const cameraPitch = useMapStore((s) => s.cameraPitch)
  const setCameraPitch = useMapStore((s) => s.setCameraPitch)
  const setCameraPitchAnimated = useMapStore((s) => s.setCameraPitchAnimated)
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
    // Leave follow so the manual pitch takes effect, then animate to the toggled pitch. MapCanvas
    // applies it declaratively (follow is now off), which sidesteps rnmapbox ignoring imperative
    // camera moves while follow is active.
    disableFollow()
    setCameraPitchAnimated(nextPitchOnToggle(cameraPitch))
  }

  // Memoized so the gesture object's identity is stable across renders — MapStore's
  // setCameraPitch triggers a re-render on every drag frame (`.onUpdate` below), and a fresh
  // Gesture.Pan() per render makes RNGH re-run its native `updateGestureHandler` bridge call on
  // every frame (RNGH docs: "Gesture config should be wrapped with useMemo"). `cameraPitch` is
  // deliberately NOT a dep — it changes every frame too, which would defeat the memo — so
  // `.onBegin` reads the live pitch imperatively from the store instead of closing over it.
  // `disableFollow`/`setCameraPitch` are Zustand actions (stable by default), so these deps never
  // change and the memoized gesture keeps a stable identity across drag-frame re-renders.
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
        })
        .runOnJS(true),
    [disableFollow, setCameraPitch],
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
