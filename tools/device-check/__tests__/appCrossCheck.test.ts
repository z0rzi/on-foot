import { haversineMeters } from '../../../src/data/geo/metrics'
import { buildElevationProfile } from '../../../src/elevation/profile'
import { NO_PROGRESS, indexTrail, stepAlongTrail } from '../../../src/elevation/trailProgress'
import type { LocationFix } from '../../../src/location'
import { logcatLine } from '../../../src/log/logcatLine'
import { gateFixes } from '../../../src/recording/fixGate'
import { RECORDING_OPTIONS } from '../../../src/recording/options'
import { appLogEntries } from '../appLog'
import { captureLine, parseCapture } from '../capture'
import { buildRoute, destination, type RoutePoint } from '../geometry'
import { PACES, planJump, planMove, type Fix } from '../walkPlan'

// A walked route through the app's own pipeline: the location service's distance interval, the fix
// gate, then trail matching. If a change to either makes a planned walk record as something else
// (a dropped Jump, a fix matched to the other branch of a fold), this fails.

const START = { lat: 43.60445, lng: 1.44345 }

// Out 300 m east, a 10 m turn, back 300 m west: the two branches lie inside each other's match radius.
const turn = destination(START, 90, 300)
const back = destination(turn, 0, 10)
const FOLDED: RoutePoint[] = [
  { ...START, ele: 150 },
  { ...turn, ele: 160 },
  { ...back, ele: 160 },
  { ...destination(back, 270, 300), ele: 150 },
]

const T0 = 1_700_000_000_000

// Fixes are stamped a second apart; the service delivers only those 10 m or more from the last one.
function delivered(fixes: Fix[]): (LocationFix & { mark: number })[] {
  const out: (LocationFix & { mark: number })[] = []
  fixes.forEach((fix, i) => {
    const last = out[out.length - 1]
    if (last && haversineMeters(last.lat, last.lng, fix.lat, fix.lng) < RECORDING_OPTIONS.minDistanceM) return
    out.push({ lat: fix.lat, lng: fix.lng, ele: fix.ele, t: T0 + i * 1000, accuracy: fix.accuracy, mark: fix.mark })
  })
  return out
}

function recordWalk(speed: number) {
  const route = buildRoute(FOLDED)
  const fixes = [planJump(route, { mark: 0, offset: 0 }, 4), ...planMove(route, { mark: 0, offset: 0 }, { mark: route.length, offset: 0 }, speed, 4)]
  const points = delivered(fixes)
  const gate = gateFixes(points, null, null)
  const profile = buildElevationProfile([FOLDED])
  if (!profile) throw new Error('degenerate route')
  const trail = indexTrail(profile)
  let progress = NO_PROGRESS
  const offBranch: { mark: number; s: number | null }[] = []
  for (const point of points) {
    progress = stepAlongTrail(progress, point, trail)
    if (!progress.matched || progress.s === null || Math.abs(progress.s - point.mark) > 5) offBranch.push({ mark: point.mark, s: progress.s })
  }
  return { points, gate, offBranch }
}

describe.each([
  ['fast', PACES.fast],
  ['walk', PACES.walk],
])('a %s walk along a folded route, through the app', (_pace, speed) => {
  const { points, gate, offBranch } = recordWalk(speed)

  it('passes the fix gate whole', () => {
    expect(gate.droppedJump).toBe(0)
    expect(gate.droppedAccuracy).toBe(0)
    expect(gate.kept).toHaveLength(points.length)
  })

  it('stays matched to the branch being walked', () => {
    expect(offBranch).toEqual([])
  })
})

it('records fast walks about 16 m apart', () => {
  const { points } = recordWalk(PACES.fast)
  const gaps = points.slice(1, 15).map((p, i) => haversineMeters(points[i].lat, points[i].lng, p.lat, p.lng))
  for (const gap of gaps) expect(gap).toBeCloseTo(16, 0)
})

describe("the toolkit's reading of the app's debug-log mirror", () => {
  it("reads back what the app's writer puts in logcat, through the capture too", () => {
    const line = logcatLine({ t: 1_763_194_321_640, level: 'info', area: 'map', message: 'heading watch', detail: '{"on":false}' })
    const entry = { time: '11-15 09:12:01.640', pid: 21603, area: 'map', text: 'info map heading watch {"on":false}' }
    const read = appLogEntries(`11-15 09:12:01.640 21603 21650 I ReactNativeJS: ${line}`)
    expect(read).toEqual([entry])
    expect(parseCapture(read.map(captureLine).join('\n'))).toEqual([{ kind: 'entry', entry }])
  })
})
