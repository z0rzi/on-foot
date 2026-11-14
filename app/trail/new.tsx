import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { GpxReadError, readGpxFile } from '../../src/data/trails/gpx/readFile'
import { GpxParseResult, parseGpx } from '../../src/data/trails/gpx/parse'
import { metricsForSegments } from '../../src/data/geo/metrics'
import { useTrailsStore } from '../../src/store/trailsStore'
import { TrailGeometry, TrailMetrics } from '../../src/data/trails/types'
import { TrailForm } from '../../src/trails/TrailForm'
import { classifyGpxFailure, GpxImportFailure, gpxImportAlert } from '../../src/trails/importAlerts'
import { useGoBackOrHome } from '../../src/components/useGoBackOrHome'
import { useShowTrail } from '../../src/trails/useShowTrail'
import { LoadingScreen } from '../../src/components/LoadingScreen'
import { errorClass, logEvent } from '../../src/log'

const IMPORT_FAILURE_LOG_PHRASE: Record<GpxImportFailure, string> = {
  read: 'file could not be read',
  empty: 'no route in the file',
  format: 'not recognised as GPX',
  metrics: 'metrics could not be computed',
}

export default function NewTrailScreen() {
  const params = useLocalSearchParams<{ uri?: string; name?: string }>()
  const addTrail = useTrailsStore((s) => s.addTrail)
  const leave = useGoBackOrHome()
  const showTrail = useShowTrail()

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
      const fail = (failure: GpxImportFailure, err: unknown) => {
        // The phrase already names a read failure, so the log takes the class of its cause.
        logEvent('error', 'error', `gpx import failed, ${IMPORT_FAILURE_LOG_PHRASE[failure]}`, {
          errorClass: errorClass(err instanceof GpxReadError ? err.cause : err),
        })
        const alert = gpxImportAlert(failure)
        Alert.alert(alert.title, alert.message)
        leave()
      }
      let parsed: GpxParseResult
      try {
        const xml = await readGpxFile(params.uri)
        parsed = parseGpx(xml, params.name ?? null)
      } catch (err) {
        if (!cancelled) fail(classifyGpxFailure(err), err)
        return
      }
      if (cancelled) return
      let parsedMetrics: TrailMetrics
      try {
        parsedMetrics = metricsForSegments(parsed.segments)
      } catch (err) {
        fail('metrics', err)
        return
      }
      setGeometry({ segments: parsed.segments, waypoints: parsed.waypoints })
      setMetrics(parsedMetrics)
      setName(parsed.title ?? params.name ?? '')
      setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [params.uri, params.name, leave])

  if (loading || !metrics || !geometry) return <LoadingScreen />

  return (
    <TrailForm
      metrics={metrics}
      initialName={name}
      initialDifficulty={null}
      initialDescription=""
      submitLabel="I'm done"
      onSubmit={async ({ name: submittedName, difficulty, description }) => {
        const id = await addTrail({ name: submittedName, difficulty, description, metrics, geometry })
        showTrail({ id, name: submittedName }, { added: true })
      }}
    />
  )
}
