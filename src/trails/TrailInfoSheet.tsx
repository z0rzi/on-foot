import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { SharedValue } from 'react-native-reanimated'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { Trail } from '../data/trails/types'
import { formatDistance, formatElevation, formatMetricsSummary } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'
import { useOfflineController } from '../map/provider'
import { useOfflineStore } from '../map/offline/offlineStore'
import { offlineStateForTrail } from '../map/offline/badge'
import { packIdsForTrail } from '../map/offline/operations'
import { runPackDownload } from '../map/offline/download'
import { OfflineLayerChooser } from '../map/offline/OfflineLayerChooser'
import { OfflineActionsMenu } from '../map/offline/OfflineActionsMenu'

export function TrailInfoSheet({
  trail,
  animatedPosition,
}: {
  trail: Trail
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const router = useRouter()
  const controller = useOfflineController()
  const packs = useOfflineStore((s) => s.packs)
  const progress = useOfflineStore((s) => s.progress)
  const clearProgress = useOfflineStore((s) => s.clearProgress)
  const refreshPacks = useOfflineStore((s) => s.refreshPacks)
  const chooserRef = useRef<BottomSheetModal>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const state = offlineStateForTrail(trail.id, packs, progress)

  useEffect(() => {
    refreshPacks(controller)
  }, [refreshPacks, controller, trail.id])

  const removeAll = () => {
    Alert.alert('Remove offline maps', `Remove downloaded maps for "${trail.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const ids = packIdsForTrail(packs, trail.id)
          await Promise.all(ids.map((id) => controller.deletePack(id)))
          ids.forEach(clearProgress)
          await refreshPacks(controller)
        },
      },
    ])
  }

  const retry = () => {
    packIdsForTrail(packs, trail.id).forEach((id) =>
      runPackDownload(controller, id, () => controller.resumePack(id)),
    )
  }

  const cancel = async () => {
    const ids = packIdsForTrail(packs, trail.id)
    await Promise.all(ids.map((id) => controller.deletePack(id)))
    ids.forEach(clearProgress)
    await refreshPacks(controller)
  }

  const menuItems =
    state.kind === 'none'
      ? [{ label: 'Download for offline', onPress: () => chooserRef.current?.present() }]
      : state.kind === 'available'
        ? [
            { label: 'Edit offline layers', onPress: () => chooserRef.current?.present() },
            { label: 'Manage offline maps', onPress: () => router.push('/settings/offline') },
            { label: 'Remove offline maps', danger: true, onPress: removeAll },
          ]
        : state.kind === 'failed'
          ? [
              { label: 'Retry download', onPress: retry },
              { label: 'Remove offline maps', danger: true, onPress: removeAll },
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
          <Text style={[styles.badge, { color: c.difficultyEasy }]}>✓ Offline</Text>
        )}
        {state.kind === 'failed' && (
          <Text style={[styles.badge, { color: c.danger }]}>⚠ Failed</Text>
        )}
        <Pressable accessibilityLabel="Offline actions" onPress={() => setMenuOpen((o) => !o)} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={20} color={c.onSurfaceVariant} />
        </Pressable>
        {menuOpen && <OfflineActionsMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
      </View>

      {state.kind === 'downloading' ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: c.panelDivider }]}>
            <View style={[styles.progressFill, { backgroundColor: c.controlAccent, width: `${state.pct}%` }]} />
          </View>
          <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>Downloading… {state.pct}%</Text>
        </View>
      ) : (
        <View style={styles.summaryRow}>
          <DifficultyBadge difficulty={trail.difficulty} />
          <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
            {formatMetricsSummary(trail.metrics)}
          </Text>
        </View>
      )}

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
