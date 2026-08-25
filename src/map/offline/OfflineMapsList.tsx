import { useCallback } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useTheme } from '../../theme/useTheme'
import { useMapCapabilities, useOfflineController } from '../provider'
import { useOfflineStore } from './offlineStore'
import { useTrailsStore } from '../../store/trailsStore'
import { groupPacksByTrail, totalOfflineBytes } from './grouping'
import { formatBytes } from './format'
import { packId } from './packId'
import { showToast } from '../../components/toast'

export function OfflineMapsList() {
  const c = useTheme()
  const caps = useMapCapabilities()
  const controller = useOfflineController()
  const labelFor = (styleId: string) => caps.styles.find((s) => s.id === styleId)?.label ?? styleId
  const packs = useOfflineStore((s) => s.packs)
  const remove = useOfflineStore((s) => s.remove)
  const trails = useTrailsStore((s) => s.trails)
  const loadTrails = useTrailsStore((s) => s.loadTrails)

  useFocusEffect(
    useCallback(() => {
      loadTrails()
    }, [loadTrails]),
  )

  const groups = groupPacksByTrail(packs, trails)
  const total = totalOfflineBytes(packs)

  const removeLayer = (trailId: number, styleId: string, trailName: string | null) => {
    Alert.alert('Remove layer', `Remove this offline layer for "${trailName ?? 'Unknown trail'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove(controller, [packId(trailId, styleId)]).then(() => showToast('Layer removed')),
      },
    ])
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.storage, { backgroundColor: c.surface }]}>
        <Text style={{ color: c.onSurfaceVariant, fontSize: 12 }}>Storage used by offline maps</Text>
        <Text style={{ color: c.onSurface, fontSize: 15, fontWeight: '700', marginTop: 4 }}>{formatBytes(total)}</Text>
      </View>

      <Text style={[styles.section, { color: c.onSurfaceVariant }]}>TRAILS</Text>
      {groups.length === 0 ? (
        <Text style={{ color: c.onSurfaceVariant, paddingHorizontal: 4 }}>No offline maps yet.</Text>
      ) : (
        groups.map((g) => (
          <View key={g.trailId} style={[styles.group, { backgroundColor: c.surface }]}>
            <View style={styles.groupHead}>
              <Ionicons name="trail-sign" size={16} color={c.trailLine} />
              <Text style={{ color: c.onSurface, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {g.trailName ?? 'Unknown trail'}
              </Text>
              <Text style={{ color: c.onSurfaceVariant, fontSize: 11 }}>{formatBytes(g.totalBytes)}</Text>
            </View>
            {g.layers.map((l) => (
              <View key={l.styleId} style={[styles.layer, { borderTopColor: c.panelDivider }]}>
                <Text style={{ color: c.onSurface, fontSize: 13, flex: 1 }}>{labelFor(l.styleId)}</Text>
                <Text style={{ color: c.onSurfaceVariant, fontSize: 11, marginRight: 12 }}>{formatBytes(l.sizeBytes)}</Text>
                <Pressable
                  accessibilityLabel={`Remove ${labelFor(l.styleId)} for ${g.trailName ?? 'unknown trail'}`}
                  onPress={() => removeLayer(g.trailId, l.styleId, g.trailName)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={c.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        ))
      )}

      <Text style={[styles.section, { color: c.onSurfaceVariant, marginTop: 20 }]}>AREAS · LATER</Text>
      <View style={[styles.areaPlaceholder, { borderColor: c.panelDivider }]}>
        <Text style={{ color: c.onSurfaceVariant, fontSize: 13 }}>＋ Download a custom area</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  storage: { borderRadius: 12, padding: 14, marginBottom: 18 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginLeft: 2 },
  group: { borderRadius: 12, paddingHorizontal: 14, marginBottom: 14 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  layer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1 },
  areaPlaceholder: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 16, alignItems: 'center', opacity: 0.6 },
})
