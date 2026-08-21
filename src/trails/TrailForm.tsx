import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { Difficulty, TrailMetrics } from '../data/trails/types'
import { DifficultySelector } from './DifficultySelector'
import { MetricsRow } from './MetricsRow'
import { useTheme } from '../theme/useTheme'

export interface TrailFormValues {
  name: string
  difficulty: Difficulty
  description: string | null
}

export function TrailForm({
  metrics,
  initialName,
  initialDifficulty,
  initialDescription,
  title,
  submitLabel,
  onSubmit,
}: {
  metrics: TrailMetrics
  initialName: string
  initialDifficulty: Difficulty | null
  initialDescription: string
  title: string
  submitLabel: string
  onSubmit: (values: TrailFormValues) => Promise<void>
}) {
  const c = useTheme()
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(initialDifficulty)
  const [description, setDescription] = useState(initialDescription)
  const [saving, setSaving] = useState(false)

  const canSave = name.trim().length > 0 && difficulty !== null && !saving

  const onSave = useCallback(async () => {
    if (difficulty === null) return
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        difficulty,
        description: description.trim().length > 0 ? description.trim() : null,
      })
      router.back()
    } catch {
      Alert.alert('Could not save trail', 'Something went wrong while saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [description, difficulty, name, onSubmit, router])

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerLeft: () => (
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={c.onSurface} />
            </Pressable>
          ),
        }}
      />
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
            {saving ? <ActivityIndicator color={c.surface} /> : <Text style={[styles.saveLabel, { color: c.surface }]}>{submitLabel}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  save: { marginTop: 12, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveLabel: { fontSize: 16, fontWeight: '700' },
})
