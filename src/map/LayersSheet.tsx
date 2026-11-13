import React from 'react'
import { StyleSheet, Text } from 'react-native'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useTheme } from '../theme/useTheme'
import { useMapCapabilities } from './provider'
import { useMapStore, type OverviewToggles } from '../store/mapStore'
import { ModalSheet } from '../components/ModalSheet'
import { PreviewTile, PreviewTileGrid } from '../components/PreviewTile'

const OVERVIEW_TOGGLES: { kind: keyof OverviewToggles; title: string; preview: number }[] = [
  { kind: 'trails', title: 'Trails', preview: require('../assets/overview/trails.png') },
  { kind: 'activities', title: 'Activities', preview: require('../assets/overview/activities.png') },
]

// The map's layer, one of the provider's, and which kinds the overview draws (D119). A choice
// applies at once on the map behind; the menu stays open (D130).
export function LayersSheet({ ref }: { ref: React.RefObject<BottomSheetModal | null> }) {
  const c = useTheme()
  const caps = useMapCapabilities()
  const mapStyleId = useMapStore((s) => s.mapStyleId)
  const setMapStyle = useMapStore((s) => s.setMapStyle)
  const toggles = useMapStore((s) => s.overviewToggles)
  const setOverviewToggle = useMapStore((s) => s.setOverviewToggle)
  const sectionStyle = [styles.section, { color: c.onSurfaceVariant }]

  return (
    <ModalSheet ref={ref} title="Map layers">
      <Text style={sectionStyle}>Map</Text>
      <PreviewTileGrid>
        {caps.styles.map((s) => (
          <PreviewTile
            key={s.id}
            preview={s.preview}
            title={s.label}
            role="radio"
            checked={s.id === mapStyleId}
            accessibilityLabel={`${s.label} map layer`}
            onPress={() => setMapStyle(s.id)}
          />
        ))}
      </PreviewTileGrid>
      <Text style={sectionStyle}>Show on map</Text>
      <PreviewTileGrid>
        {OVERVIEW_TOGGLES.map((t) => (
          <PreviewTile
            key={t.kind}
            preview={t.preview}
            title={t.title}
            role="checkbox"
            checked={toggles[t.kind]}
            accessibilityLabel={`Show ${t.title.toLowerCase()} on map`}
            onPress={() => setOverviewToggle(t.kind, !toggles[t.kind])}
          />
        ))}
      </PreviewTileGrid>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
})
