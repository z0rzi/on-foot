import type { ElevationProfile } from './profile'

// Where along a trail a recording is, as the profile distance `s` the elevation graph plots. One
// rule per recorded point: the trail's passes within MATCH_RADIUS_METERS of it are the candidates;
// none leaves `s` where it was and marks the point off the trail; otherwise the first point takes
// the nearest pass and every later one the pass whose distance is closest to `s`, so an overlap,
// an out-and-back or a crossing keeps the branch being walked. The puck sits at the last point's
// `s`, and nowhere when that point matched nothing.
//
// Inside one stretch of the trail, the fix takes its nearest point. Where the trail doubles back on
// itself within GPS error (the turnaround of an out-and-back, a hairpin), that stretch has two
// near-equal nearest points that position alone cannot tell apart, so the one running the way the
// walker is moving wins.

// Wide enough to absorb GPS error on the trail, or the puck flickers out while walking it.
export const MATCH_RADIUS_METERS = 25

const METRES_PER_DEGREE = (Math.PI * 6371000) / 180
const CELL_METERS = 2 * MATCH_RADIUS_METERS
// Two passes whose in-radius stretches meet within this gap are one continuous pass.
const CONTIGUOUS_METERS = 0.5
// Nearest points of one pass closer than this to each other's distance are a fold, not a choice.
const FOLD_METERS = 5
// Below this the walker's motion between two fixes has no usable direction.
const MIN_MOTION_METERS = 1

interface Edge {
  ax: number
  ay: number
  bx: number
  by: number
  sa: number
  sb: number
}

// The trail's first point, which local metre coordinates are measured from.
interface Origin {
  originLat: number
  originLng: number
  cosLat: number
}

export interface TrailIndex extends Origin {
  edges: Edge[]
  // Edge ids per grid cell, so a point is matched against the edges near it rather than the whole
  // trail: a long recording replays thousands of points.
  cells: Map<string, number[]>
}

interface LatLng { lat: number; lng: number }

export interface TrailProgress {
  s: number | null
  matched: boolean
  // The previous recorded point, for the walker's direction of motion.
  last: LatLng | null
}

export const NO_PROGRESS: TrailProgress = { s: null, matched: false, last: null }

const cellKey = (cx: number, cy: number) => `${cx}:${cy}`

const toLocal = (p: LatLng, origin: Origin): [number, number] => [
  (p.lng - origin.originLng) * origin.cosLat * METRES_PER_DEGREE,
  (p.lat - origin.originLat) * METRES_PER_DEGREE,
]

export function indexTrail(profile: ElevationProfile): TrailIndex {
  const { samples } = profile
  const origin: Origin = {
    originLat: samples[0].lat,
    originLng: samples[0].lng,
    cosLat: Math.cos((samples[0].lat * Math.PI) / 180),
  }
  const edges: Edge[] = []
  const cells = new Map<string, number[]>()
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    if (a.segment !== b.segment) continue
    const [ax, ay] = toLocal(a, origin)
    const [bx, by] = toLocal(b, origin)
    if (ax === bx && ay === by) continue
    const id = edges.push({ ax, ay, bx, by, sa: a.distance, sb: b.distance }) - 1
    for (let cx = Math.floor(Math.min(ax, bx) / CELL_METERS); cx <= Math.floor(Math.max(ax, bx) / CELL_METERS); cx++) {
      for (let cy = Math.floor(Math.min(ay, by) / CELL_METERS); cy <= Math.floor(Math.max(ay, by) / CELL_METERS); cy++) {
        const key = cellKey(cx, cy)
        const bucket = cells.get(key)
        if (bucket) bucket.push(id)
        else cells.set(key, [id])
      }
    }
  }
  return { ...origin, edges, cells }
}

// The part of one edge within the radius: its extent in `s`, its nearest point to the fix, and the
// edge's direction of travel.
interface Piece { from: number; to: number; s: number; distance: number; dx: number; dy: number }

// One continuous stretch of trail within the radius.
interface Pass { to: number; pieces: Piece[] }

function pieceOnEdge(e: Edge, px: number, py: number): Piece | null {
  const dx = e.bx - e.ax
  const dy = e.by - e.ay
  const length = Math.hypot(dx, dy)
  const along = ((px - e.ax) * dx + (py - e.ay) * dy) / length
  const across = Math.abs((px - e.ax) * dy - (py - e.ay) * dx) / length
  if (across > MATCH_RADIUS_METERS) return null
  const half = Math.sqrt(MATCH_RADIUS_METERS ** 2 - across ** 2)
  const t0 = Math.max(0, (along - half) / length)
  const t1 = Math.min(1, (along + half) / length)
  if (t0 > t1) return null
  const t = Math.max(0, Math.min(1, along / length))
  const sAt = (u: number) => e.sa + (e.sb - e.sa) * u
  return {
    from: sAt(t0),
    to: sAt(t1),
    s: sAt(t),
    distance: Math.hypot(e.ax + dx * t - px, e.ay + dy * t - py),
    dx,
    dy,
  }
}

function passesNear([px, py]: [number, number], trail: TrailIndex): Pass[] {
  const ids = new Set<number>()
  for (let cx = Math.floor((px - MATCH_RADIUS_METERS) / CELL_METERS); cx <= Math.floor((px + MATCH_RADIUS_METERS) / CELL_METERS); cx++) {
    for (let cy = Math.floor((py - MATCH_RADIUS_METERS) / CELL_METERS); cy <= Math.floor((py + MATCH_RADIUS_METERS) / CELL_METERS); cy++) {
      trail.cells.get(cellKey(cx, cy))?.forEach((id) => ids.add(id))
    }
  }
  const pieces: Piece[] = []
  ids.forEach((id) => {
    const piece = pieceOnEdge(trail.edges[id], px, py)
    if (piece) pieces.push(piece)
  })
  pieces.sort((a, b) => a.from - b.from)
  const passes: Pass[] = []
  for (const piece of pieces) {
    const last = passes[passes.length - 1]
    if (last && piece.from <= last.to + CONTIGUOUS_METERS) {
      last.to = Math.max(last.to, piece.to)
      last.pieces.push(piece)
    } else {
      passes.push({ to: piece.to, pieces: [piece] })
    }
  }
  return passes
}

const nearestOf = (pieces: Piece[]): Piece =>
  pieces.reduce((best, p) => (p.distance < best.distance ? p : best))

function pointOfPass(pass: Pass, motion: [number, number] | null): Piece {
  const nearest = nearestOf(pass.pieces)
  if (!motion) return nearest
  const fold = pass.pieces.filter((p) => p.distance <= nearest.distance + FOLD_METERS)
  const along = fold.filter((p) => p.dx * motion[0] + p.dy * motion[1] > 0)
  return along.length > 0 ? nearestOf(along) : nearest
}

export function stepAlongTrail(state: TrailProgress, point: LatLng, trail: TrailIndex): TrailProgress {
  const here = toLocal(point, trail)
  let motion: [number, number] | null = null
  if (state.last) {
    const [lx, ly] = toLocal(state.last, trail)
    if (Math.hypot(here[0] - lx, here[1] - ly) >= MIN_MOTION_METERS) motion = [here[0] - lx, here[1] - ly]
  }
  const candidates = passesNear(here, trail).map((pass) => pointOfPass(pass, motion))
  if (candidates.length === 0) return { s: state.s, matched: false, last: point }
  const previous = state.s
  const cost = (p: Piece) => (previous === null ? p.distance : Math.abs(p.s - previous))
  let best = candidates[0]
  for (const candidate of candidates) if (cost(candidate) < cost(best)) best = candidate
  return { s: best.s, matched: true, last: point }
}

export function replayAlongTrail(points: readonly LatLng[], trail: TrailIndex, from: TrailProgress = NO_PROGRESS): TrailProgress {
  return points.reduce((state, point) => stepAlongTrail(state, point, trail), from)
}

// A replay carried across point batches. Recording points only ever append, keeping their objects,
// so the same trail and the same first point mean the earlier points are unchanged and only the new
// ones are stepped; anything else replays from the start.
export interface TrailReplay {
  trail: TrailIndex
  first: LatLng | undefined
  count: number
  progress: TrailProgress
}

export function advanceReplay(
  previous: TrailReplay | null,
  points: readonly LatLng[],
  trail: TrailIndex,
): TrailReplay {
  const continues =
    previous !== null &&
    previous.trail === trail &&
    previous.first === points[0] &&
    points.length >= previous.count
  const progress = continues
    ? replayAlongTrail(points.slice(previous.count), trail, previous.progress)
    : replayAlongTrail(points, trail)
  return { trail, first: points[0], count: points.length, progress }
}

export function puckDistance(progress: TrailProgress): number | null {
  return progress.matched ? progress.s : null
}
