import { useCallback, useState } from 'react'
import { Alert, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { Difficulty, TrailMetrics } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/geo/metrics'
import { EnumSelector } from '../components/EnumSelector'
import { MetricsGrid } from '../components/MetricsGrid'
import { FormField, FormScreen, FormTextInput, SubmitButton } from '../components/form'
import { difficultyField } from './difficulty'
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
    <>
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
      <FormScreen>
        <MetricsGrid
          items={[
            { label: 'Distance', value: formatDistance(metrics.distanceMeters) },
            { label: 'Elevation Gain', value: formatElevation(metrics.elevationGainMeters) },
            { label: 'Elevation Loss', value: formatElevation(metrics.elevationLossMeters) },
          ]}
        />

        <FormField label="Name *">
          <FormTextInput value={name} onChangeText={setName} placeholder="Trail name" />
        </FormField>

        <FormField label="Difficulty *">
          <EnumSelector field={difficultyField} value={difficulty} onChange={setDifficulty} />
        </FormField>

        <FormField label="Description">
          <FormTextInput value={description} onChangeText={setDescription} placeholder="Optional" multiline />
        </FormField>

        <SubmitButton
          accessibilityLabel="Save trail"
          label={submitLabel}
          busy={saving}
          disabled={!canSave}
          onPress={onSave}
        />
      </FormScreen>
    </>
  )
}
