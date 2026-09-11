import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Trail, trailsRepository } from '../../../src/data/trails'
import { useTrailsStore } from '../../../src/store/trailsStore'
import { TrailForm } from '../../../src/trails/TrailForm'
import { useTheme } from '../../../src/theme/useTheme'
import { useGoBackOrHome } from '../../../src/components/useGoBackOrHome'
import { ScreenHeader } from '../../../src/components/ScreenHeader'

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
      <ScreenHeader title="Edit Trail" onBack={leave} />
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
