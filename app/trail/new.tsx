import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTrailsStore } from '../../src/store/trailsStore'
import { TrailForm } from '../../src/trails/TrailForm'
import { gpxImportAlert } from '../../src/trails/importAlerts'
import { readTrailFile, TrailFile } from '../../src/trails/importTrail'
import { useGoBackOrHome } from '../../src/components/useGoBackOrHome'
import { useShowTrail } from '../../src/trails/useShowTrail'
import { LoadingScreen } from '../../src/components/LoadingScreen'

export default function NewTrailScreen() {
  const params = useLocalSearchParams<{ uri?: string; name?: string }>()
  const addTrail = useTrailsStore((s) => s.addTrail)
  const leave = useGoBackOrHome()
  const showTrail = useShowTrail()

  const [file, setFile] = useState<TrailFile | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!params.uri) {
        leave()
        return
      }
      const reading = await readTrailFile(params.uri, params.name ?? null)
      if (cancelled) return
      if (!reading.ok) {
        const alert = gpxImportAlert(reading.failure)
        Alert.alert(alert.title, alert.message)
        leave()
        return
      }
      setFile(reading.file)
    }
    void run()
    return () => { cancelled = true }
  }, [params.uri, params.name, leave])

  if (!file) return <LoadingScreen />

  return (
    <TrailForm
      metrics={file.metrics}
      initialName={file.name}
      initialDifficulty={null}
      initialDescription=""
      submitLabel="I'm done"
      onSubmit={async ({ name, difficulty, description }) => {
        const id = await addTrail({ name, difficulty, description, metrics: file.metrics, geometry: file.geometry })
        showTrail({ id, name }, { added: true })
      }}
    />
  )
}
