import React, { useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useTheme } from '../../theme/useTheme'
import { useMapCapabilities, useOfflineController } from '../provider'
import { useMapStore } from '../../store/mapStore'
import { useOfflineStore } from './offlineStore'
import { boundsForTrail } from './bounds'
import { flattenSegments } from '../geo'
import { estimatePackSize, layerKindForStyle } from './estimate'
import { packId, packsForTrail } from './packId'
import { packDescriptor } from './descriptor'
import { formatBytes } from '../../format/units'
import { OFFLINE_MARGIN_KM, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM } from './constants'
import { showToast } from '../../components/toast'
import { logEvent } from '../../log'
import { ModalSheet } from '../../components/ModalSheet'
import { PreviewTile, PreviewTileGrid } from '../../components/PreviewTile'
import { guardDownload } from './downloadConsent'
import { planOfflineChanges, seedSelection } from './plan'
import type { Trail } from '../../data/trails/types'

export function OfflineLayerChooser({ ref, trail }: { ref: React.RefObject<BottomSheetModal | null>; trail: Trail }) {
  const c = useTheme()
  const caps = useMapCapabilities()
  const controller = useOfflineController()
  const currentStyleId = useMapStore((s) => s.mapStyleId)
  const packs = useOfflineStore((s) => s.packs)
  const download = useOfflineStore((s) => s.download)
  const remove = useOfflineStore((s) => s.remove)

  const bounds = useMemo(() => boundsForTrail(flattenSegments(trail.geometry.segments), OFFLINE_MARGIN_KM), [trail])

  // The trail's already-downloaded layers, from the completed packs on disk (no dependency on
  // live progress, so opening the chooser doesn't re-render on every download tick).
  const downloadedIds = useMemo(
    () =>
      packsForTrail(packs, trail.id)
        .filter(({ pack }) => pack.state === 'complete')
        .map(({ styleId }) => styleId),
    [packs, trail.id],
  )

  // The user's ticks are kept only while this key holds: they reset when the trail, the
  // downloaded set (by value, so an unrelated packs reload keeps them) or the current style changes.
  const seedKey = JSON.stringify([trail.id, downloadedIds, currentStyleId])
  const [edit, setEdit] = useState<{ seedKey: string; selected: Set<string> } | null>(null)
  const selected = edit?.seedKey === seedKey ? edit.selected : seedSelection(downloadedIds, currentStyleId)

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setEdit({ seedKey, selected: next })
  }

  // Memoized so the per-style tile-counting loops only recompute when the trail bounds,
  // downloaded set, or pack sizes change — not on unrelated re-renders.
  const rows = useMemo(
    () =>
      caps.styles.map((s) => {
        const kind = layerKindForStyle(s.satellite)
        const estimateBytes = bounds ? estimatePackSize(bounds, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM, kind) : null
        const downloaded = downloadedIds.includes(s.id)
        const actualBytes = packs.find((p) => p.id === packId(trail.id, s.id))?.sizeBytes ?? null
        return { style: s, kind, estimateBytes, downloaded, actualBytes }
      }),
    [caps.styles, bounds, downloadedIds, packs, trail.id],
  )

  const plan = planOfflineChanges(
    rows.map((r) => ({ styleId: r.style.id, downloaded: r.downloaded, estimateBytes: r.estimateBytes })),
    selected,
  )

  const apply = () => {
    if (!bounds) {
      logEvent('warn', 'error', 'download refused, trail has no route', { trailId: trail.id })
      Alert.alert('Cannot download', 'This trail has no route to cover.')
      return
    }
    if (plan.removes.length) {
      void remove(controller, plan.removes.map((id) => packId(trail.id, id))).then(() =>
        showToast('Offline map updated'),
      )
    }

    const dismiss = () => ref.current?.dismiss()

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
    <ModalSheet ref={ref} title="Offline map" subtitle={`${trail.name} · tick to download, untick to remove`}>
      <PreviewTileGrid>
        {rows.map((r) => {
          const status = r.downloaded
            ? `✓ Downloaded · ${formatBytes(r.actualBytes ?? r.estimateBytes ?? 0)}`
            : r.estimateBytes !== null
              ? `~${formatBytes(r.estimateBytes)}`
              : 'unavailable'
          return (
            <PreviewTile
              key={r.style.id}
              preview={r.style.preview}
              title={r.style.label}
              role="checkbox"
              checked={selected.has(r.style.id)}
              accessibilityLabel={`${r.style.label} layer, ${status}`}
              onPress={() => toggle(r.style.id)}
            >
              <Text
                style={[styles.status, { color: r.downloaded ? c.controlAccent : r.kind === 'raster' ? c.warning : c.onSurfaceVariant }]}
              >
                {status}
              </Text>
            </PreviewTile>
          )
        })}
      </PreviewTileGrid>

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
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  status: { fontSize: 11, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  apply: { padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
})
