import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { readGpxFile } from '../../src/data/trails/gpx/readFile'
import { GpxError, GpxParseResult, parseGpx } from '../../src/data/trails/gpx/parse'
import { metricsForSegments } from '../../src/data/geo/metrics'
import { useTrailsStore } from '../../src/store/trailsStore'
import { TrailGeometry, TrailMetrics } from '../../src/data/trails/types'
import { TrailForm } from '../../src/trails/TrailForm'
import { useTheme } from '../../src/theme/useTheme'

export default function NewTrailScreen() {
  const c = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ uri?: string; name?: string }>()
  const addTrail = useTrailsStore((s) => s.addTrail)

  // A system "Open with" cold-starts the app on this route, so there is no history to pop and a
  // bare back() would strand the user here.
  const leave = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/')),
    [router],
  )

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
        if (err instanceof GpxError && err.reason === 'empty') {
          Alert.alert('No route found', 'This GPX file has no route or track points to import.')
        } else {
          Alert.alert('Not a GPX file', 'This file could not be read as GPX.')
        }
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

  if (loading || !metrics || !geometry) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.controlAccent} />
      </View>
    )
  }

  return (
    <TrailForm
      metrics={metrics}
      initialName={name}
      initialDifficulty={null}
      initialDescription=""
      title="New Trail"
      submitLabel="I'm done"
      onSubmit={async ({ name: submittedName, difficulty, description }) => {
        await addTrail({ name: submittedName, difficulty, description, metrics, geometry })
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
