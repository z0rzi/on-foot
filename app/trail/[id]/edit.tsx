import { Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { loadTrail } from '../../../src/data/trails'
import { useTrailsStore } from '../../../src/store/trailsStore'
import { TrailForm } from '../../../src/trails/TrailForm'
import { useGoBackOrHome } from '../../../src/components/useGoBackOrHome'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { LoadingScreen } from '../../../src/components/LoadingScreen'
import { useLoadedEntity } from '../../../src/components/useLoadedEntity'

export default function EditTrailScreen() {
  const leave = useGoBackOrHome()
  const params = useLocalSearchParams<{ id: string }>()
  const id = Number(params.id)
  const updateTrail = useTrailsStore((s) => s.updateTrail)

  // A trail that is gone was deleted from under this screen, which needs no explanation; a failed
  // read does.
  const loaded = useLoadedEntity(id, loadTrail, {
    label: 'trail',
    onUnavailable: (reason) => {
      if (reason === 'error') {
        Alert.alert('Could not open this trail', 'Something went wrong. Please try again.')
      }
      leave()
    },
  })

  if (loaded.status !== 'ready') return <LoadingScreen />
  const trail = loaded.entity

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
