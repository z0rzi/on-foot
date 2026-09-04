import { useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { SharedValue } from 'react-native-reanimated'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import { Trail } from '../data/trails/types'
import { formatDistance, formatElevation, formatMetricsSummary } from '../data/geo/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'
import { ElevationGraph } from '../elevation/ElevationGraph'
import type { ElevationProfile } from '../elevation/profile'
import { useMapCapabilities, useOfflineController } from '../map/provider'
import { useOfflineStore } from '../map/offline/offlineStore'
import { offlineStateForTrail } from '../map/offline/badge'
import { retryTargetsForTrail } from '../map/offline/operations'
import { boundsForTrail } from '../map/offline/bounds'
import { flattenSegments } from '../map/geo'
import { packDescriptor } from '../map/offline/descriptor'
import { OFFLINE_MARGIN_KM } from '../map/offline/constants'
import { OfflineLayerChooser } from '../map/offline/OfflineLayerChooser'
import { OfflineActionsMenu } from '../map/offline/OfflineActionsMenu'
import { showToast } from '../components/toast'
import { guardDownload } from '../map/offline/downloadConsent'

export function TrailInfoSheet({
  trail,
  profile,
  animatedPosition,
}: {
  trail: Trail
  profile: ElevationProfile | null
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const caps = useMapCapabilities()
  const controller = useOfflineController()
  const packs = useOfflineStore((s) => s.packs)
  const progress = useOfflineStore((s) => s.progress)
  const download = useOfflineStore((s) => s.download)
  const resume = useOfflineStore((s) => s.resume)
  const removeForTrail = useOfflineStore((s) => s.removeForTrail)
  const chooserRef = useRef<BottomSheetModal>(null)
  const dotsRef = useRef<View>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)

  // Measure the ⋮ in window coords so the Modal-hosted menu can anchor its bottom-right corner to
  // the button and open upward.
  const openMenu = () => {
    dotsRef.current?.measureInWindow((x, y, width) => setMenuAnchor({ x: x + width, y }))
  }

  const state = offlineStateForTrail(trail.id, packs, progress)

  const removeAll = () => {
    Alert.alert('Remove offline map', `Remove the offline map for "${trail.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeForTrail(controller, trail.id).then(() => showToast('Offline map removed'))
        },
      },
    ])
  }

  // Retry each failed/incomplete layer: resume a pack that exists (keeps partial progress), or
  // re-issue the download for a phantom failure that left no pack behind.
  const retry = () => {
    const bounds = boundsForTrail(flattenSegments(trail.geometry.segments), OFFLINE_MARGIN_KM)
    void guardDownload(null, () => {
      retryTargetsForTrail(packs, progress, trail.id).forEach((t) => {
        if (t.hasPack) {
          resume(controller, t.id)
          return
        }
        const style = caps.styles.find((s) => s.id === t.styleId)
        if (style && bounds) download(controller, packDescriptor(trail.id, style, bounds))
      })
    })
  }

  const cancel = () => removeForTrail(controller, trail.id).then(() => showToast('Download canceled'))

  const downloadingLabel =
    state.kind === 'downloading'
      ? state.styleIds.map((id) => caps.styles.find((s) => s.id === id)?.label ?? id).join(', ')
      : ''

  const menuItems =
    state.kind === 'none'
      ? [{ label: 'Download offline map', onPress: () => chooserRef.current?.present() }]
      : state.kind === 'available'
        ? [
            { label: 'Edit offline map', onPress: () => chooserRef.current?.present() },
            { label: 'Remove offline map', danger: true, onPress: removeAll },
          ]
        : state.kind === 'failed'
          ? [
              { label: 'Retry download', onPress: retry },
              { label: 'Edit offline map', onPress: () => chooserRef.current?.present() },
              { label: 'Remove offline map', danger: true, onPress: removeAll },
            ]
          : [{ label: 'Cancel download', danger: true, onPress: cancel }]

  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <View style={styles.titleRow}>
        <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{trail.name}</Text>
        {state.kind === 'downloading' && (
          <Text style={[styles.badge, { color: c.controlAccent }]}>⬇ {state.pct}%</Text>
        )}
        {state.kind === 'available' && (
          <Text style={[styles.badge, { color: c.success }]}>✓ Offline</Text>
        )}
        {state.kind === 'failed' && (
          <Text style={[styles.badge, { color: c.danger }]}>⚠ Failed</Text>
        )}
        <View ref={dotsRef} collapsable={false}>
          <Pressable accessibilityLabel="Offline actions" onPress={openMenu} hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={20} color={c.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>

      {state.kind === 'downloading' ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: c.panelDivider }]}>
            <View style={[styles.progressFill, { backgroundColor: c.controlAccent, width: `${state.pct}%` }]} />
          </View>
          <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
            Downloading {downloadingLabel} · {state.pct}%
          </Text>
        </View>
      ) : (
        <View style={styles.summaryRow}>
          <DifficultyBadge difficulty={trail.difficulty} />
          <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
            {formatMetricsSummary(trail.metrics)}
          </Text>
        </View>
      )}

      {profile && <ElevationGraph profile={profile} placement="inSheet" />}

      <MetricsGrid
        items={[
          { label: 'Distance', value: formatDistance(trail.metrics.distanceMeters) },
          { label: 'Elev. Gain', value: formatElevation(trail.metrics.elevationGainMeters) },
          { label: 'Elev. Loss', value: formatElevation(trail.metrics.elevationLossMeters) },
        ]}
      />

      {trail.description != null && (
        <Text style={[styles.comments, { color: c.panelContent }]}>{trail.description}</Text>
      )}

      <OfflineLayerChooser ref={chooserRef} trail={trail} />

      {menuAnchor && (
        <OfflineActionsMenu items={menuItems} anchor={menuAnchor} onClose={() => setMenuAnchor(null)} />
      )}
    </MapInfoSheet>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '700', flex: 1 },
  badge: { fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  progressWrap: { gap: 6 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  comments: { fontSize: 14, lineHeight: 20 },
})
