import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsFocused } from 'expo-router'
import { advanceReplay, indexTrail, puckDistance, type TrailIndex, type TrailReplay } from '../elevation/trailProgress'
import { useAppActive } from '../recording/appActivity'
import type { RouteDisplay } from '../elevation/routeDisplay'
import type { MapMode } from '../store/mapStore'
import type { LiveTrackPoint } from '../data/activities/types'

// Where the graph's puck sits, as a profile distance, or null for none. Only a recording has one:
// along a trail it is the recording's place on the trail, along no trail the live profile's end.
// The trail replay runs only while the Map is focused (it stays mounted under pushed screens) and
// the app is active: it starts over from the first point on each return, then steps per batch.
export function useGraphPuck(
  mode: MapMode,
  display: RouteDisplay | null,
  livePoints: LiveTrackPoint[],
): number | null {
  const focused = useIsFocused()
  const active = useAppActive()
  const engaged = focused && active && mode === 'recording'
  const trailProfile = display?.kind === 'trail' ? display.profile : null
  const trail = useMemo(() => (trailProfile ? indexTrail(trailProfile) : null), [trailProfile])
  const replay = useRef<TrailReplay | null>(null)
  const [alongTrail, setAlongTrail] = useState<{ trail: TrailIndex; s: number | null } | null>(null)

  useEffect(() => {
    if (!engaged || !trail) {
      replay.current = null
      return
    }
    replay.current = advanceReplay(replay.current, livePoints, trail)
    setAlongTrail({ trail, s: puckDistance(replay.current.progress) })
  }, [engaged, trail, livePoints])

  if (!engaged || !display) return null
  if (display.kind === 'live') return display.profile.totalDistance
  return alongTrail && alongTrail.trail === trail ? alongTrail.s : null
}
