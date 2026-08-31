import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { readGpxFile } from '../../src/data/trails/gpx/readFile'
import { parseGpx } from '../../src/data/trails/gpx/parse'
import { metricsForSegments } from '../../src/data/trails/gpx/metrics'
import { useTrailsStore } from '../../src/store/trailsStore'
import { TrailGeometry, TrailMetrics } from '../../src/data/trails/types'
import { TrailForm } from '../../src/trails/TrailForm'
import { useTheme } from '../../src/theme/useTheme'

export default function NewTrailScreen() {
  const c = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ uri?: string; name?: string }>()
  const addTrail = useTrailsStore((s) => s.addTrail)

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<TrailMetrics | null>(null)
  const [geometry, setGeometry] = useState<TrailGeometry | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!params.uri) {
        router.back()
        return
      }
      try {
        const xml = await readGpxFile(params.uri)
        const parsed = parseGpx(xml, params.name ?? null)
        if (cancelled) return
        setGeometry({ segments: parsed.segments, waypoints: parsed.waypoints })
        setMetrics(metricsForSegments(parsed.segments))
        setName(parsed.title ?? params.name ?? '')
        setLoading(false)
      } catch {
        if (!cancelled) {
          setLoading(false)
          router.back()
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [params.uri, params.name, router])

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
