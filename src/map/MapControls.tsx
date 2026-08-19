import React from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ControlButton } from '../components/ControlButton'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useMapCapabilities } from './provider'
import { useMapStore } from '../store/mapStore'
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

  // Heading tracking is Phase 2 — the tracked heading is hardcoded to 0 for now,
  // so the North button stays hidden until Phase 2 wires up real bearing.
  const heading = 0
  const following = followMode !== 'off'
  const LocationIcon = followMode === 'positionAndBearing' ? PositionFollowIcon : PositionIcon

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
        <ControlButton accessibilityLabel="Toggle 2D/3D" onPress={() => { /* Phase 2 */ }}>
          <Text style={{ color: c.controlsText, fontWeight: 'bold', fontSize: 11 }}>3D</Text>
        </ControlButton>
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
