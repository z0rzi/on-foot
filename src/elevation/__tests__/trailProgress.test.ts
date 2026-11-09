import { buildElevationProfile } from '../profile'
import {
  NO_PROGRESS,
  advanceReplay,
  indexTrail,
  puckDistance,
  replayAlongTrail,
  stepAlongTrail,
  type TrailProgress,
} from '../trailProgress'

// Points are written in metres east (x) and north (y) of an origin, so a scenario reads as a sketch.
const METRES_PER_DEGREE = (Math.PI * 6371000) / 180
const ORIGIN_LAT = 45
type Xy = [number, number]

const at = ([x, y]: Xy) => ({
  lat: ORIGIN_LAT + y / METRES_PER_DEGREE,
  lng: x / (METRES_PER_DEGREE * Math.cos((ORIGIN_LAT * Math.PI) / 180)),
})

// A trail drawn through sparse vertices only, as a hand-drawn GPX often is.
const trailThrough = (...vertices: Xy[]) => {
  const profile = buildElevationProfile([vertices.map((v) => ({ ...at(v), ele: 100 }))])
  if (!profile) throw new Error('degenerate trail')
  return indexTrail(profile)
}

// A walk along a polyline, one recorded point every 5 m.
const walk = (...waypoints: Xy[]) => {
  const points: { lat: number; lng: number }[] = [at(waypoints[0])]
  for (let i = 1; i < waypoints.length; i++) {
    const [ax, ay] = waypoints[i - 1]
    const [bx, by] = waypoints[i]
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 5))
    for (let k = 1; k <= steps; k++) points.push(at([ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps]))
  }
  return points
}

const expectPuckAt = (progress: TrailProgress, metres: number) => {
  const d = puckDistance(progress)
  expect(d).not.toBeNull()
  expect(Math.abs((d as number) - metres)).toBeLessThan(3)
}

describe('stepAlongTrail', () => {
  it('follows a walk forward along a straight trail', () => {
    const trail = trailThrough([0, 0], [1000, 0])
    expectPuckAt(replayAlongTrail(walk([0, 0], [400, 0]), trail), 400)
  })

  it('tracks the point, not the window edge, a few metres off the line', () => {
    const trail = trailThrough([0, 0], [1000, 0])
    expectPuckAt(replayAlongTrail(walk([0, 8], [400, 8]), trail), 400)
  })

  it('places nothing before any point', () => {
    expect(puckDistance(NO_PROGRESS)).toBeNull()
    const trail = trailThrough([0, 0], [1000, 0])
    expect(stepAlongTrail(NO_PROGRESS, at([300, 0]), trail).s).not.toBeNull()
  })
})

describe('the walking scenarios', () => {
  it('out-and-back: on the way back the puck is on the return leg', () => {
    const trail = trailThrough([0, 0], [1000, 0], [0, 0])
    const out = walk([0, 0], [1000, 0])
    expectPuckAt(replayAlongTrail(out, trail), 1000)
    expectPuckAt(replayAlongTrail([...out, ...walk([1000, 0], [300, 0])], trail), 1700)
  })

  it('shared loop: back on the shared stem, the puck is on the homeward stretch', () => {
    const trail = trailThrough([0, 0], [500, 0], [1000, 0], [1000, 500], [500, 500], [500, 0], [0, 0])
    const points = walk([0, 0], [500, 0], [1000, 0], [1000, 500], [500, 500], [500, 0], [200, 0])
    expectPuckAt(replayAlongTrail(points, trail), 3000 - 200)
  })

  it('leave and rejoin elsewhere: off the trail there is no puck, back on it snaps to the rejoin', () => {
    const trail = trailThrough([0, 0], [2000, 0])
    const out = walk([0, 0], [500, 0], [500, 200], [1500, 200])
    const away = replayAlongTrail(out, trail)
    expect(puckDistance(away)).toBeNull()
    expect(away.s).not.toBeNull()
    expectPuckAt(replayAlongTrail([...out, ...walk([1500, 200], [1500, 0], [1600, 0])], trail), 1600)
  })

  it('GPS glitch: one wild fix hides the puck, the next fix on the trail restores it', () => {
    const trail = trailThrough([0, 0], [1000, 0])
    const before = walk([0, 0], [400, 0])
    const glitched = replayAlongTrail([...before, at([400, 300])], trail)
    expect(puckDistance(glitched)).toBeNull()
    expectPuckAt(replayAlongTrail([...before, at([400, 300]), ...walk([405, 0], [450, 0])], trail), 450)
  })

  it('same-direction overlap rejoin: a detour on the second lap rejoins the second lap', () => {
    const lap: Xy[] = [[400, 0], [400, 400], [0, 400], [0, 0]]
    const trail = trailThrough([0, 0], ...lap, ...lap)
    const points = walk([0, 0], ...lap, [200, 0], [200, -100], [300, -100], [300, 0], [320, 0])
    expectPuckAt(replayAlongTrail(points, trail), 1600 + 320)
  })

  it('cold start on an overlap: a recording begun on the loop knows which stem pass it is on', () => {
    const trail = trailThrough([0, 0], [500, 0], [1000, 0], [1000, 500], [500, 500], [500, 0], [0, 0])
    const points = walk([1000, 250], [1000, 500], [500, 500], [500, 0], [200, 0])
    expectPuckAt(replayAlongTrail(points, trail), 3000 - 200)
  })

  it('figure-8: crossing the first pass keeps the puck on the second', () => {
    const trail = trailThrough([0, 0], [400, 400], [400, 0], [0, 400], [0, 0])
    const diagonal = 400 * Math.SQRT2
    const points = walk([0, 0], [400, 400], [400, 0], [200, 200])
    expectPuckAt(replayAlongTrail(points, trail), diagonal + 400 + diagonal / 2)
  })

  it('backwards: turning round walks the puck back down the profile', () => {
    const trail = trailThrough([0, 0], [1000, 0])
    expectPuckAt(replayAlongTrail(walk([0, 0], [600, 0], [200, 0]), trail), 200)
  })

  it('out-and-back turned early: walking home before the end goes back down the outward leg', () => {
    const trail = trailThrough([0, 0], [1000, 0], [0, 0])
    expectPuckAt(replayAlongTrail(walk([0, 0], [600, 0], [400, 0]), trail), 400)
  })

  it('switchbacks walked downhill stay on the leg underfoot, not a parallel leg running the same way', () => {
    const trail = trailThrough([0, 0], [200, 0], [200, 15], [0, 15], [0, 30], [200, 30])
    const legTwo = 215
    const points = walk([200, 30], [0, 30], [0, 15], [100, 15])
    expectPuckAt(replayAlongTrail(points, trail), legTwo + 100)
  })

  it('replay equals step-by-step', () => {
    const trail = trailThrough([0, 0], [500, 0], [1000, 0], [1000, 500], [500, 500], [500, 0], [0, 0])
    const points = walk([0, 0], [500, 0], [1000, 0], [1000, 500], [700, 500], [700, 700], [500, 500], [500, 0])
    let stepped = NO_PROGRESS
    const trace: TrailProgress[] = []
    for (const p of points) {
      stepped = stepAlongTrail(stepped, p, trail)
      trace.push(stepped)
    }
    expect(replayAlongTrail(points, trail)).toEqual(stepped)
    const half = Math.floor(points.length / 2)
    expect(replayAlongTrail(points.slice(half), trail, trace[half - 1])).toEqual(stepped)
  })
})

describe('advanceReplay', () => {
  const trail = trailThrough([0, 0], [1000, 0], [0, 0])
  const points = walk([0, 0], [1000, 0], [300, 0])

  it('stepping batch by batch lands where a full replay does', () => {
    let replay = advanceReplay(null, points.slice(0, 50), trail)
    replay = advanceReplay(replay, points.slice(0, 210), trail)
    replay = advanceReplay(replay, points, trail)
    expect(replay.progress).toEqual(replayAlongTrail(points, trail))
  })

  it('replays from the start for another trail', () => {
    const other = trailThrough([0, 0], [1000, 0])
    const replay = advanceReplay(advanceReplay(null, points, trail), points, other)
    expect(replay.progress).toEqual(replayAlongTrail(points, other))
  })

  it('replays from the start for another recording', () => {
    const fresh = walk([0, 0], [200, 0])
    const replay = advanceReplay(advanceReplay(null, points, trail), fresh, trail)
    expect(replay.progress).toEqual(replayAlongTrail(fresh, trail))
  })
})
