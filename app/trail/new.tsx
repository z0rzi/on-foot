import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { GpxReadError, readGpxFile } from '../../src/data/trails/gpx/readFile'
import { GpxError, GpxParseResult, parseGpx } from '../../src/data/trails/gpx/parse'
import { metricsForSegments } from '../../src/data/geo/metrics'
import { useTrailsStore } from '../../src/store/trailsStore'
import { TrailGeometry, TrailMetrics } from '../../src/data/trails/types'
import { TrailForm } from '../../src/trails/TrailForm'
import { gpxImportAlert } from '../../src/trails/importAlerts'
import { useGoBackOrHome } from '../../src/components/useGoBackOrHome'
import { ScreenHeader } from '../../src/components/ScreenHeader'
import { LoadingScreen } from '../../src/components/LoadingScreen'
import { logEvent } from '../../src/log'

export default function NewTrailScreen() {
  const params = useLocalSearchParams<{ uri?: string; name?: string }>()
  const addTrail = useTrailsStore((s) => s.addTrail)
  const leave = useGoBackOrHome('/trails')

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<TrailMetrics | null>(null)
  const [geometry, setGeometry] = useState<TrailGeometry | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!params.uri) {
        leave()
        return
      }
      let parsed: GpxParseResult
      try {
        const xml = await readGpxFile(params.uri)
        parsed = parseGpx(xml, params.name ?? null)
      } catch (err) {
        if (cancelled) return
        const reason =
          err instanceof GpxReadError
            ? 'file could not be read'
            : err instanceof GpxError && err.reason === 'empty'
              ? 'no route in the file'
              : 'not recognised as GPX'
        logEvent('error', 'error', `gpx import failed, ${reason}`, { error: String(err) })
        const alert = gpxImportAlert(err)
        Alert.alert(alert.title, alert.message)
        leave()
        return
      }
      if (cancelled) return
      setGeometry({ segments: parsed.segments, waypoints: parsed.waypoints })
      setMetrics(metricsForSegments(parsed.segments))
      setName(parsed.title ?? params.name ?? '')
      setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [params.uri, params.name, leave])

  if (loading || !metrics || !geometry) return <LoadingScreen />

  return (
    <>
      <ScreenHeader title="New Trail" onBack={leave} />
      <TrailForm
        metrics={metrics}
        initialName={name}
        initialDifficulty={null}
        initialDescription=""
        submitLabel="I'm done"
        onSubmit={async ({ name: submittedName, difficulty, description }) => {
          await addTrail({ name: submittedName, difficulty, description, metrics, geometry })
          leave()
        }}
      />
    </>
  )
}
