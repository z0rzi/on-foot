import React, { forwardRef, useCallback, useMemo, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/useTheme'
import { useMapCapabilities, useOfflineController } from '../provider'
import { useMapStore } from '../../store/mapStore'
import { useOfflineStore } from './offlineStore'
import { boundsForTrail } from './bounds'
import { flattenSegments } from '../geo'
import { estimatePackSize, layerKindForStyle } from './estimate'
import { packId, parsePackId } from './packId'
import { packDescriptor } from './descriptor'
import { formatBytes } from './format'
import { OFFLINE_MARGIN_KM, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM } from './constants'
import { showToast } from '../../components/toast'
import { useSheetBackDismiss } from '../../components/useSheetBackDismiss'
import { guardDownload } from './downloadConsent'
import { planOfflineChanges, seedSelection } from './plan'
import type { Trail } from '../../data/trails/types'

export const OfflineLayerChooser = forwardRef<BottomSheetModal, { trail: Trail }>(
  function OfflineLayerChooser({ trail }, ref) {
    const c = useTheme()
    const caps = useMapCapabilities()
    const controller = useOfflineController()
    const currentStyleId = useMapStore((s) => s.mapStyleId)
    const packs = useOfflineStore((s) => s.packs)
    const download = useOfflineStore((s) => s.download)
    const remove = useOfflineStore((s) => s.remove)

    const snapPoints = useMemo(() => ['65%'], [])
    const onChange = useSheetBackDismiss(
      useCallback(() => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss(), [ref]),
    )
    const bounds = useMemo(() => boundsForTrail(flattenSegments(trail.geometry.segments), OFFLINE_MARGIN_KM), [trail])

    // The trail's already-downloaded layers, from the completed packs on disk (no dependency on
    // live progress, so opening the chooser doesn't re-render on every download tick).
    const downloadedIds = useMemo(
      () =>
        packs
          .filter((p) => parsePackId(p.id)?.trailId === trail.id && p.state === 'complete')
          .map((p) => parsePackId(p.id)!.styleId),
      [packs, trail.id],
    )

    // The user's ticks are kept only while this key holds: they reset when the trail, the
    // downloaded set (by value, so an unrelated packs reload keeps them) or the current style changes.
    const seedKey = `${trail.id}|${downloadedIds.join(',')}|${currentStyleId}`
    const [edit, setEdit] = useState<{ seedKey: string; selected: Set<string> } | null>(null)
    const selected = edit?.seedKey === seedKey ? edit.selected : seedSelection(downloadedIds, currentStyleId)

    const toggle = (id: string) => {
      const next = new Set(selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setEdit({ seedKey, selected: next })
    }

    // Memoized so the per-style tile-count estimate loops only recompute when the trail bounds,
    // downloaded set, or pack sizes change — not on unrelated re-renders.
    const rows = useMemo(
      () =>
        caps.styles.map((s) => {
          const kind = layerKindForStyle(s.satellite)
          const estimate = bounds ? estimatePackSize(bounds, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM, kind) : null
          const downloaded = downloadedIds.includes(s.id)
          const actualBytes = packs.find((p) => p.id === packId(trail.id, s.id))?.sizeBytes ?? null
          return { style: s, kind, estimate, downloaded, actualBytes }
        }),
      [caps.styles, bounds, downloadedIds, packs, trail.id],
    )

    const plan = planOfflineChanges(
      rows.map((r) => ({ styleId: r.style.id, downloaded: r.downloaded, estimateBytes: r.estimate?.bytes ?? null })),
      selected,
    )

    // Dim + tap-outside-to-close: tapping the backdrop dismisses the sheet (swipe-down still works).
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      ),
      [],
    )

    const apply = () => {
      if (!bounds) {
        Alert.alert('Cannot download', 'This trail has no route to cover.')
        return
      }
      if (plan.removes.length) {
        void remove(controller, plan.removes.map((id) => packId(trail.id, id))).then(() =>
          showToast('Offline map updated'),
        )
      }

      const dismiss = () => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()

      if (plan.adds.length) {
        void guardDownload(plan.toDownloadBytes || null, () => {
          rows
            .filter((r) => plan.adds.includes(r.style.id))
            .forEach((r) => download(controller, packDescriptor(trail.id, r.style, bounds)))
          dismiss()
        })
      } else {
        dismiss()
      }
    }

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        onChange={onChange}
        backgroundStyle={{ backgroundColor: c.panelBackground }}
        handleIndicatorStyle={{ backgroundColor: c.onSurfaceVariant }}
      >
        <BottomSheetView style={styles.content}>
          <Text style={[styles.title, { color: c.panelContent }]}>Offline map</Text>
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
                  <Text style={{ fontSize: 11, color: r.downloaded ? c.controlAccent : r.kind === 'raster' ? c.warning : c.onSurfaceVariant }}>
                    {r.downloaded
                      ? `✓ Downloaded · ${formatBytes(r.actualBytes ?? r.estimate?.bytes ?? 0)}`
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
              {plan.toDownloadBytes ? `~${formatBytes(plan.toDownloadBytes)}` : '—'}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Apply offline map changes"
            disabled={!plan.hasChanges}
            onPress={apply}
            style={[styles.apply, { backgroundColor: c.controlAccent, opacity: plan.hasChanges ? 1 : 0.5 }]}
          >
            <Text style={{ color: c.onControlAccent, fontWeight: '700', fontSize: 14 }}>Apply</Text>
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
