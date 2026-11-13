import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Trail } from '../data/trails/types'
import { useTheme } from '../theme/useTheme'
import { MetricsGrid } from '../components/MetricsGrid'
import { EnumBadge } from '../components/EnumBadge'
import { difficultyField } from './difficulty'
import { TrailDescription } from './TrailDescription'
import { trailMetricTiles } from './format'
import { useMapCapabilities } from '../map/provider'
import { useOfflineStore } from '../map/offline/offlineStore'
import { offlineStatusForTrail } from '../map/offline/status'
import type { MenuAnchor } from '../components/ActionsMenu'
import { ActionsMenuButton } from '../components/ActionsMenuButton'
import { TrailActions } from './TrailActions'
import { FamilyList } from '../activities/FamilyList'

export function TrailInfoSheet({
  trail,
  onSelectActivity,
}: {
  trail: Trail
  onSelectActivity: (id: number) => void
}) {
  const c = useTheme()
  const caps = useMapCapabilities()
  const packs = useOfflineStore((s) => s.packs)
  const progress = useOfflineStore((s) => s.progress)
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  const state = offlineStatusForTrail(trail.id, packs, progress)

  const downloadingLabel =
    state.kind === 'downloading'
      ? state.styleIds.map((id) => caps.styles.find((s) => s.id === id)?.label ?? id).join(', ')
      : ''

  return (
    <>
      <View style={styles.titleRow}>
        <Text style={[styles.name, { color: c.panelContent }]}>{trail.name}</Text>
        {state.kind === 'downloading' && (
          <Text style={[styles.badge, { color: c.controlAccent }]}>⬇ {state.pct}%</Text>
        )}
        {state.kind === 'available' && (
          <Text style={[styles.badge, { color: c.success }]}>✓ Offline</Text>
        )}
        {state.kind === 'failed' && (
          <Text style={[styles.badge, { color: c.danger }]}>⚠ Failed</Text>
        )}
        <ActionsMenuButton accessibilityLabel="Trail actions" onOpen={setMenuAnchor} />
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
          <EnumBadge field={difficultyField} value={trail.difficulty} />
        </View>
      )}

      <MetricsGrid items={trailMetricTiles(trail.metrics)} />

      <TrailDescription trail={trail} />

      <FamilyList trailId={trail.id} onSelectActivity={onSelectActivity} />

      <TrailActions trail={trail} anchor={menuAnchor} onCloseMenu={() => setMenuAnchor(null)} />
    </>
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
})
