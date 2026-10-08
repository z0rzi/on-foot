import { useCallback, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text } from 'react-native'
import { ActivityMetrics, Effort } from '../data/activities/types'
import { formatDistance, formatElevation } from '../format/units'
import { formatDuration } from './format'
import { EnumSelector } from '../components/EnumSelector'
import { MetricsGrid } from '../components/MetricsGrid'
import { FormField, FormScreen, FormTextInput, SubmitButton } from '../components/form'
import { effortField } from './effort'
import { useTheme } from '../theme/useTheme'
import { logEvent } from '../log'

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
    } catch (error) {
      logEvent('error', 'error', 'saving the activity failed', { error: String(error) })
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
          onDiscard().catch((error) => {
            logEvent('error', 'error', 'discarding the activity failed', { error: String(error) })
            Alert.alert('Could not discard', 'Something went wrong. Please try again.')
            setBusy(false)
          })
        },
      },
    ])
  }, [onDiscard])

  return (
    <FormScreen>
      <MetricsGrid
        items={[
          { label: 'Distance', value: formatDistance(metrics.distanceMeters) },
          { label: 'Duration', value: formatDuration(metrics.durationSeconds) },
          { label: 'Elevation Gain', value: formatElevation(metrics.elevationGainMeters) },
        ]}
      />

      <FormField label="Name *">
        <FormTextInput value={name} onChangeText={setName} placeholder="Activity name" />
      </FormField>

      <FormField label="Effort *">
        <EnumSelector field={effortField} value={effort} onChange={setEffort} />
      </FormField>

      <FormField label="Comments">
        <FormTextInput value={comments} onChangeText={setComments} placeholder="Optional" multiline />
      </FormField>

      <SubmitButton
        accessibilityLabel="Save activity"
        label="Save activity"
        busy={busy}
        disabled={!canSave}
        onPress={handleSave}
      />

      <Pressable accessibilityLabel="Discard activity" disabled={busy} onPress={handleDiscard} style={styles.discard}>
        <Text style={[styles.discardLabel, { color: c.danger }]}>Discard</Text>
      </Pressable>
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  discard: { marginTop: 4, paddingVertical: 12, alignItems: 'center' },
  discardLabel: { fontSize: 15, fontWeight: '600' },
})
