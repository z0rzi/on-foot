import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Trail, trailsRepository } from '../../../src/data/trails'
import { useTrailsStore } from '../../../src/store/trailsStore'
import { TrailForm } from '../../../src/trails/TrailForm'
import { useTheme } from '../../../src/theme/useTheme'
import { useGoBackOrHome } from '../../../src/components/useGoBackOrHome'

export default function EditTrailScreen() {
  const c = useTheme()
  const leave = useGoBackOrHome()
  const params = useLocalSearchParams<{ id: string }>()
  const id = Number(params.id)
  const updateTrail = useTrailsStore((s) => s.updateTrail)

  const [loading, setLoading] = useState(true)
  const [trail, setTrail] = useState<Trail | null>(null)

  useEffect(() => {
    let active = true
    void trailsRepository.getTrail(id).then((loaded) => {
      if (!active) return
      if (!loaded) {
        leave()
        return
      }
      setTrail(loaded)
      setLoading(false)
    })
    return () => { active = false }
  }, [id, leave])

  if (loading || !trail) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.controlAccent} />
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Trail',
          headerLeft: () => (
            <Pressable accessibilityLabel="Back" onPress={leave} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={c.onSurface} />
            </Pressable>
          ),
        }}
      />
      <TrailForm
        metrics={trail.metrics}
        initialName={trail.name}
        initialDifficulty={trail.difficulty}
        initialDescription={trail.description ?? ''}
        submitLabel="Save changes"
        onSubmit={async ({ name, difficulty, description }) => {
          await updateTrail(id, { name, difficulty, description })
          leave()
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
