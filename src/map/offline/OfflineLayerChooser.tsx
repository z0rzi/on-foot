import React, { forwardRef, useMemo, useState, useEffect } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/useTheme'
import { useMapCapabilities, useOfflineController } from '../provider'
import { useMapStore } from '../../store/mapStore'
import { useOfflineStore } from './offlineStore'
import { boundsForTrail } from './bounds'
import { estimatePackSize, layerKindForStyle } from './estimate'
import { offlineStateForTrail } from './badge'
import { packId } from './packId'
import { runPackDownload } from './download'
import { OFFLINE_MARGIN_KM, OFFLINE_MAX_ZOOM, OFFLINE_MIN_ZOOM, TILE_COUNT_WARN_THRESHOLD } from './constants'
import type { Trail } from '../../data/trails/types'

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export const OfflineLayerChooser = forwardRef<BottomSheetModal, { trail: Trail }>(
  function OfflineLayerChooser({ trail }, ref) {
    const c = useTheme()
    const caps = useMapCapabilities()
    const controller = useOfflineController()
    const currentStyleId = useMapStore((s) => s.mapStyleId)
    const packs = useOfflineStore((s) => s.packs)
    const progress = useOfflineStore((s) => s.progress)
    const refreshPacks = useOfflineStore((s) => s.refreshPacks)

    const snapPoints = useMemo(() => ['65%'], [])
    const bounds = useMemo(() => boundsForTrail(trail.geometry.points, OFFLINE_MARGIN_KM), [trail])

    const state = offlineStateForTrail(trail.id, packs, progress)
    const downloadedIds = state.kind === 'available' ? state.styleIds : []

    const [selected, setSelected] = useState<Set<string>>(new Set())
    // Seed ticks whenever the trail's downloaded set or the current style changes.
    useEffect(() => {
      setSelected(new Set(downloadedIds.length ? downloadedIds : [currentStyleId]))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trail.id, downloadedIds.join(','), currentStyleId])

    const toggle = (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })

    const rows = caps.styles.map((s) => {
      const kind = layerKindForStyle(s.satellite)
      const estimate = bounds ? estimatePackSize(bounds, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM, kind) : null
      const downloaded = downloadedIds.includes(s.id)
      return { style: s, kind, estimate, downloaded }
    })

    const toDownloadBytes = rows
      .filter((r) => selected.has(r.style.id) && !r.downloaded && r.estimate)
      .reduce((sum, r) => sum + (r.estimate?.bytes ?? 0), 0)

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    )

    const startDownload = (styleId: string, styleUrl: string) => {
      const id = packId(trail.id, styleId)
      const descriptor = {
        id,
        styleUrl,
        bounds: [bounds!.ne, bounds!.sw] as [[number, number], [number, number]],
        minZoom: OFFLINE_MIN_ZOOM,
        maxZoom: OFFLINE_MAX_ZOOM,
        meta: { trailId: trail.id, styleId },
      }
      runPackDownload(controller, id, () => controller.downloadPack(descriptor))
    }

    const apply = async () => {
      if (!bounds) {
        Alert.alert('Cannot download', 'This trail has no route to cover.')
        return
      }
      const adds = rows.filter((r) => selected.has(r.style.id) && !r.downloaded)
      const removes = rows.filter((r) => !selected.has(r.style.id) && r.downloaded)
      const big = adds.find((r) => (r.estimate?.tileCount ?? 0) > TILE_COUNT_WARN_THRESHOLD)

      const run = () => {
        adds.forEach((r) => startDownload(r.style.id, r.style.url))
        Promise.all(removes.map((r) => controller.deletePack(packId(trail.id, r.style.id)))).then(() =>
          refreshPacks(controller),
        )
        ;(ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()
      }

      if (big) {
        Alert.alert(
          'Large download',
          `${big.style.label} is about ${formatBytes(big.estimate!.bytes)}. Download on Wi‑Fi to avoid using mobile data. Continue?`,
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Download', onPress: run }],
        )
      } else {
        run()
      }
    }

    const hasChanges =
      rows.some((r) => selected.has(r.style.id) && !r.downloaded) ||
      rows.some((r) => !selected.has(r.style.id) && r.downloaded)

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: c.panelBackground }}
        handleIndicatorStyle={{ backgroundColor: c.onSurfaceVariant }}
      >
        <BottomSheetView style={styles.content}>
          <Text style={[styles.title, { color: c.panelContent }]}>Offline layers</Text>
          <Text style={[styles.sub, { color: c.onSurfaceVariant }]} numberOfLines={1}>
            {trail.name} · tick to download, untick to remove
          </Text>

          {rows.map((r) => {
            const on = selected.has(r.style.id)
            return (
              <Pressable
                key={r.style.id}
                accessibilityLabel={`${r.style.label} layer`}
                onPress={() => toggle(r.style.id)}
                style={[styles.row, { borderColor: on ? c.controlAccent : c.panelDivider }]}
              >
                <Image source={r.style.preview} style={styles.swatch} resizeMode="cover" />
                <View style={styles.meta}>
                  <Text style={[styles.name, { color: c.panelContent }]}>{r.style.label}</Text>
                  <Text style={{ fontSize: 11, color: r.downloaded ? c.controlAccent : r.kind === 'raster' ? c.difficultyHard : c.onSurfaceVariant }}>
                    {r.downloaded
                      ? `✓ Downloaded · ${r.estimate ? formatBytes(r.estimate.bytes) : ''}`
                      : r.estimate
                        ? `~${formatBytes(r.estimate.bytes)}`
                        : 'unavailable'}
                  </Text>
                </View>
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={on ? c.controlAccent : c.onSurfaceVariant}
                />
              </Pressable>
            )
          })}

          <View style={styles.totalRow}>
            <Text style={{ color: c.onSurfaceVariant, fontSize: 12 }}>To download</Text>
            <Text style={{ color: c.panelContent, fontSize: 13, fontWeight: '700' }}>
              {toDownloadBytes ? `~${formatBytes(toDownloadBytes)}` : '—'}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Apply offline layers"
            disabled={!hasChanges}
            onPress={apply}
            style={[styles.apply, { backgroundColor: c.controlAccent, opacity: hasChanges ? 1 : 0.5 }]}
          >
            <Text style={{ color: c.controlsText, fontWeight: '700', fontSize: 14 }}>Apply</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    )
  },
)

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 11, textAlign: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderRadius: 12 },
  swatch: { width: 42, height: 42, borderRadius: 8 },
  meta: { flex: 1 },
  name: { fontSize: 13, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  apply: { padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
})
