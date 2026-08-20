import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { readGpxFile } from '../../src/data/trails/gpx/readFile'
import { parseGpx } from '../../src/data/trails/gpx/parse'
import { computeMetrics } from '../../src/data/trails/gpx/metrics'
import { useTrailsStore } from '../../src/store/trailsStore'
import { Difficulty, TrailGeometry, TrailMetrics } from '../../src/data/trails/types'
import { DifficultySelector } from '../../src/trails/DifficultySelector'
import { MetricsRow } from '../../src/trails/MetricsRow'
import { useTheme } from '../../src/theme/useTheme'

export default function TrailFormScreen() {
  const c = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ uri?: string; name?: string }>()
  const addTrail = useTrailsStore((s) => s.addTrail)

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<TrailMetrics | null>(null)
  const [geometry, setGeometry] = useState<TrailGeometry | null>(null)
  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!params.uri) {
        router.back()
        return
      }
      try {
        const xml = await readGpxFile(params.uri)
        const parsed = parseGpx(xml, params.name ?? null)
        if (cancelled) return
        setGeometry({ points: parsed.points, waypoints: parsed.waypoints })
        setMetrics(computeMetrics(parsed.points))
        setName(parsed.title ?? params.name ?? '')
        setLoading(false)
      } catch {
        if (!cancelled) {
          setLoading(false)
          router.back()
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [params.uri, params.name, router])

  const canSave = name.trim().length > 0 && difficulty !== null && !saving

  const onSave = useCallback(async () => {
    if (!metrics || !geometry || difficulty === null) return
    setSaving(true)
    try {
      await addTrail({
        name: name.trim(),
        difficulty,
        description: description.trim().length > 0 ? description.trim() : null,
        metrics,
        geometry,
      })
      router.back()
    } catch {
      Alert.alert('Could not save trail', 'Something went wrong while saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [addTrail, description, difficulty, geometry, metrics, name, router])

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New Trail',
          headerLeft: () => (
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={c.onSurface} />
            </Pressable>
          ),
        }}
      />
      {loading || !metrics ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.controlAccent} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <MetricsRow metrics={metrics} />

            <Text style={[styles.label, { color: c.onSurface }]}>Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Trail name"
              placeholderTextColor={c.onSurfaceVariant}
              style={[styles.input, { color: c.onSurface, borderColor: c.panelDivider }]}
            />

            <Text style={[styles.label, { color: c.onSurface }]}>Difficulty *</Text>
            <DifficultySelector value={difficulty} onChange={setDifficulty} />

            <Text style={[styles.label, { color: c.onSurface }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              placeholderTextColor={c.onSurfaceVariant}
              multiline
              style={[styles.input, styles.multiline, { color: c.onSurface, borderColor: c.panelDivider }]}
            />

            <Pressable
              accessibilityLabel="Save trail"
              disabled={!canSave}
              onPress={onSave}
              style={[styles.save, { backgroundColor: c.controlAccent, opacity: canSave ? 1 : 0.5 }]}
            >
              {saving ? <ActivityIndicator color={c.surface} /> : <Text style={[styles.saveLabel, { color: c.surface }]}>I'm done</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  save: { marginTop: 12, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveLabel: { fontSize: 16, fontWeight: '700' },
})
