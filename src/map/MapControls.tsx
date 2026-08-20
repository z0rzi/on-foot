import React, { useMemo, useRef } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { ControlButton } from '../components/ControlButton'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useMapCapabilities } from './provider'
import { useMapStore, nextPitchOnToggle, clampPitch, shouldShowNorthButton } from '../store/mapStore'
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
  const quickSwitchMapStyle = useMapStore((s) => s.quickSwitchMapStyle)
  const cameraPitch = useMapStore((s) => s.cameraPitch)
  const setCameraPitch = useMapStore((s) => s.setCameraPitch)
  const setCameraPitchAnimated = useMapStore((s) => s.setCameraPitchAnimated)
  const disableFollow = useMapStore((s) => s.disableFollow)
  const northPressed = useMapStore((s) => s.northPressed)
  // The live camera bearing drives both the button's visibility and the needle's counter-rotation
  // (so the red tip always points at true north, mirroring the Kotlin `rotationZ = -cameraBearing`).
  // This selector only re-renders on actual rotation — panning/zooming keep heading unchanged, so
  // Zustand's Object.is check skips the update.
  const cameraHeading = useMapStore((s) => s.cameraHeading)
  const showNorth = shouldShowNorthButton(cameraHeading, MapTokens.bearingThreshold)

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

  // The provider's styles as the seam-neutral choices the store's quick-switch logic consumes
  // (id + satellite flag) — the store never learns provider-specific style ids this way.
  const styleChoices = useMemo(
    () => caps.styles.map((s) => ({ id: s.id, satellite: s.satellite })),
    [caps.styles],
  )
  // Swipe the layers button (any direction, past a small threshold) to quick-switch the layer
  // without opening the sheet. A real swipe activates the pan and RNGH cancels the button's
  // onPress, so a plain tap still opens the sheet. Memoized for the same stability reason as `pan`.
  const layerSwipe = useMemo(
    () =>
      Gesture.Pan()
        .onEnd((e) => {
          if (Math.hypot(e.translationX, e.translationY) > MapTokens.layerSwipeThreshold) {
            quickSwitchMapStyle(styleChoices)
          }
        })
        .runOnJS(true),
    [quickSwitchMapStyle, styleChoices],
  )

  return (
    <View
      style={[
        styles.col,
        { bottom: insets.bottom + MapTokens.overlayPadding, right: MapTokens.overlayPadding },
      ]}
    >
      {showNorth && (
        <ControlButton accessibilityLabel="Reset north" onPress={northPressed}>
          <View style={{ transform: [{ rotate: `${-cameraHeading}deg` }] }}>
            <NorthIcon size={MapTokens.controlIconSize} color={c.controlContent} />
          </View>
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
      <GestureDetector gesture={layerSwipe}>
        <ControlButton accessibilityLabel="Open map layers" onPress={onOpenLayers}>
          <LayersIcon size={MapTokens.controlIconSize} color={c.controlContent} />
        </ControlButton>
      </GestureDetector>
      <ControlButton accessibilityLabel="Center on your location" onPress={cycleFollowMode}>
        <LocationIcon size={MapTokens.controlIconSize} color={following ? c.controlAccent : c.controlContent} />
      </ControlButton>
    </View>
  )
}

const styles = StyleSheet.create({
  col: { position: 'absolute', gap: MapTokens.controlsSpacing, alignItems: 'flex-end' },
})
