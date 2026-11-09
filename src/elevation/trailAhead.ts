import { sampleAt, type ElevationProfile, type ElevationSample } from './profile'
import type { RouteDisplay } from './routeDisplay'
import { smoothProfile } from './slope'
import { toblerSeconds } from './tobler'

// The climb rule (D85, D93) and the walking time (D86) read their own fixed smoothing, never the display
// preference, so neither moves when the graph's smoothing changes.
const AHEAD_SMOOTHING_METERS = 50
const MIN_CLIMB_GAIN_METERS = 20
const MIN_CLIMB_GRADE = 0.04
const MAX_CLIMB_DROP_METERS = 10
const CLIMB_FLAT_METERS = 300

export type ClimbAhead =
  | { kind: 'next'; distanceMeters: number; walkingSeconds: number; heightMeters: number }
  | { kind: 'climbing'; heightMeters: number; walkingSeconds: number }
  | { kind: 'none' }

export interface TrailAhead {
  leftMeters: number
  walkingSeconds: number
  climb: ClimbAhead
}

// Distances along the profile of a climb's foot and top.
interface Climb { foot: number; top: number }

// The trail's smoothed profile and its climbs.
interface Course { profile: ElevationProfile; climbs: Climb[] }

// One course per route display, which useRouteDisplay keeps across renders and fix batches, so the
// puck moving along a trail never smooths its profile or finds its climbs again.
const courses = new WeakMap<RouteDisplay, Course>()

function courseOf(display: RouteDisplay): Course {
  let course = courses.get(display)
  if (!course) {
    const profile = smoothProfile(display.profile, AHEAD_SMOOTHING_METERS)
    course = { profile, climbs: findClimbs(profile) }
    courses.set(display, course)
  }
  return course
}

// What is left of a trail from `alongMeters` along its profile, counted toward the trail's own end,
// with walking times scaled by the personal factor.
export function trailAhead(display: RouteDisplay, alongMeters: number, factor: number): TrailAhead {
  const { profile, climbs } = courseOf(display)
  const at = Math.min(alongMeters, profile.totalDistance)
  const eleAt = (d: number) => sampleAt(profile, d).ele
  const timeTo = (d: number) => walkingSeconds(profile, at, d) * factor
  const climb = climbs.find((c) => c.top > at)
  return {
    leftMeters: profile.totalDistance - at,
    walkingSeconds: timeTo(profile.totalDistance),
    climb: climbAhead(climb, at, eleAt, timeTo),
  }
}

// Seconds to walk the profile from `from` to `to`, step by step at Tobler's speed.
// A step across a gap between segments is not walked.
function walkingSeconds({ samples }: ElevationProfile, from: number, to: number): number {
  let seconds = 0
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    const span = b.distance - a.distance
    const walked = Math.min(b.distance, to) - Math.max(a.distance, from)
    if (a.segment !== b.segment || span <= 0 || walked <= 0) continue
    seconds += toblerSeconds(walked, (b.ele - a.ele) / span)
  }
  return seconds
}

function climbAhead(
  climb: Climb | undefined,
  at: number,
  eleAt: (d: number) => number,
  timeTo: (d: number) => number,
): ClimbAhead {
  if (!climb) return { kind: 'none' }
  if (climb.foot <= at) {
    return { kind: 'climbing', heightMeters: eleAt(climb.top) - eleAt(at), walkingSeconds: timeTo(climb.top) }
  }
  return {
    kind: 'next',
    distanceMeters: climb.foot - at,
    walkingSeconds: timeTo(climb.foot),
    heightMeters: eleAt(climb.top) - eleAt(climb.foot),
  }
}

// A climb is a climbing stretch, or several joined: the next stretch joins when the ground between
// is shorter than CLIMB_FLAT_METERS, never falls more than MAX_CLIMB_DROP_METERS below the climb's
// top so far, and the climb to the end of that stretch still averages MIN_CLIMB_GRADE. Its foot is
// its first stretch's start, its top its last stretch's end. It counts when it gains at least
// MIN_CLIMB_GAIN_METERS. Nothing spans a gap between segments.
function findClimbs({ samples }: ElevationProfile): Climb[] {
  const found: Climb[] = []
  const keep = ({ start, end }: Stretch) => {
    if (samples[end].ele - samples[start].ele >= MIN_CLIMB_GAIN_METERS) {
      found.push({ foot: samples[start].distance, top: samples[end].distance })
    }
  }
  let climb: Stretch | undefined
  for (const stretch of climbingStretches(samples)) {
    if (climb && joins(samples, climb, stretch)) {
      climb = { start: climb.start, end: stretch.end }
    } else {
      if (climb) keep(climb)
      climb = stretch
    }
  }
  if (climb) keep(climb)
  return found
}

// Sample indices bounding a run of steps each rising at least at MIN_CLIMB_GRADE.
interface Stretch { start: number; end: number }

function climbingStretches(samples: ElevationSample[]): Stretch[] {
  const stretches: Stretch[] = []
  let i = 0
  while (i < samples.length - 1) {
    if (!rises(samples[i], samples[i + 1])) {
      i++
      continue
    }
    let end = i + 1
    while (end < samples.length - 1 && rises(samples[end], samples[end + 1])) end++
    stretches.push({ start: i, end })
    i = end
  }
  return stretches
}

function joins(samples: ElevationSample[], climb: Stretch, next: Stretch): boolean {
  const top = samples[climb.end]
  const start = samples[next.start]
  if (top.segment !== start.segment || start.distance - top.distance >= CLIMB_FLAT_METERS) return false
  for (let k = climb.end + 1; k <= next.start; k++) {
    if (top.ele - samples[k].ele > MAX_CLIMB_DROP_METERS) return false
  }
  return rises(samples[climb.start], samples[next.end])
}

// Whether the profile rises at least at MIN_CLIMB_GRADE from a to b, on one segment.
function rises(a: ElevationSample, b: ElevationSample): boolean {
  const span = b.distance - a.distance
  return a.segment === b.segment && span > 0 && b.ele - a.ele >= MIN_CLIMB_GRADE * span
}
