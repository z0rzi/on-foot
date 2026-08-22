import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Stack } from 'expo-router'
import { ActivityMetrics, Effort } from '../data/activities/types'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { formatDuration } from './format'
import { EffortSelector } from './EffortSelector'
import { useTheme } from '../theme/useTheme'

export interface ActivityFormValues {
  name: string
  effort: Effort
  comments: string | null
}

export function ActivityForm({
  metrics,
  initialName,
  initialEffort,
  initialComments,
  onSave,
  onDiscard,
}: {
  metrics: ActivityMetrics
  initialName: string
  initialEffort: Effort | null
  initialComments: string
  onSave: (values: ActivityFormValues) => Promise<void>
  onDiscard: () => Promise<void>
}) {
  const c = useTheme()
  const [name, setName] = useState(initialName)
  const [effort, setEffort] = useState<Effort | null>(initialEffort)
  const [comments, setComments] = useState(initialComments)
  const [busy, setBusy] = useState(false)

  const canSave = name.trim().length > 0 && effort !== null && !busy

  const handleSave = useCallback(async () => {
    if (effort === null) return
    setBusy(true)
    try {
      await onSave({
        name: name.trim(),
        effort,
        comments: comments.trim().length > 0 ? comments.trim() : null,
      })
    } catch {
      Alert.alert('Could not save activity', 'Something went wrong while saving. Please try again.')
      setBusy(false)
    }
  }, [comments, effort, name, onSave])

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard activity?', 'This recording will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setBusy(true)
          onDiscard().catch(() => {
            Alert.alert('Could not discard', 'Something went wrong. Please try again.')
            setBusy(false)
          })
        },
      },
    ])
  }, [onDiscard])

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: true, title: 'Save activity', headerBackVisible: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.metrics, { backgroundColor: c.surface }]}>
            <Metric label="Distance" value={formatDistance(metrics.distanceMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
            <Metric label="Duration" value={formatDuration(metrics.durationSeconds)} color={c.onSurface} muted={c.onSurfaceVariant} />
            <Metric label="Elevation Gain" value={formatElevation(metrics.elevationGainMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
          </View>

          <Text style={[styles.label, { color: c.onSurface }]}>Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Activity name"
            placeholderTextColor={c.onSurfaceVariant}
            style={[styles.input, { color: c.onSurface, borderColor: c.panelDivider }]}
          />

          <Text style={[styles.label, { color: c.onSurface }]}>Effort *</Text>
          <EffortSelector value={effort} onChange={setEffort} />

          <Text style={[styles.label, { color: c.onSurface }]}>Comments</Text>
          <TextInput
            value={comments}
            onChangeText={setComments}
            placeholder="Optional"
            placeholderTextColor={c.onSurfaceVariant}
            multiline
            style={[styles.input, styles.multiline, { color: c.onSurface, borderColor: c.panelDivider }]}
          />

          <Pressable
            accessibilityLabel="Save activity"
            disabled={!canSave}
            onPress={handleSave}
            style={[styles.save, { backgroundColor: c.controlAccent, opacity: canSave ? 1 : 0.5 }]}
          >
            {busy ? <ActivityIndicator color={c.surface} /> : <Text style={[styles.saveLabel, { color: c.surface }]}>Save activity</Text>}
          </Pressable>

          <Pressable accessibilityLabel="Discard activity" disabled={busy} onPress={handleDiscard} style={styles.discard}>
            <Text style={[styles.discardLabel, { color: c.danger }]}>Discard</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function Metric({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: muted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  metrics: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 16 },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 16, fontWeight: '700' },
  metricLabel: { fontSize: 12, marginTop: 2 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  save: { marginTop: 12, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveLabel: { fontSize: 16, fontWeight: '700' },
  discard: { marginTop: 4, paddingVertical: 12, alignItems: 'center' },
  discardLabel: { fontSize: 15, fontWeight: '600' },
})
