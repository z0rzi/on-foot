import { devcheckName } from './devcheckData'
import { slug } from './evidence'
import { destination, type LatLng, type RoutePoint } from './geometry'

// A route described as straight stretches: `LENGTH` (flat), `LENGTH:GRADE` or `LENGTH:GRADE%`
// (climbing or, negative, descending, in percent), or `LENGTH:noele` (no elevation at all).
export interface Stretch { length: number; grade: number | null }

export interface RouteStart extends LatLng { bearing: number; ele: number }

// Place du Capitole, Toulouse: a public place, so no evidence carries the owner's position.
export const DEFAULT_ROUTE_START: RouteStart = { lat: 43.60445, lng: 1.44345, bearing: 45, ele: 146 }

const POINT_SPACING_M = 10

export function parseStretches(specs: string[]): Stretch[] {
  if (specs.length === 0) throw new Error('a route needs at least one stretch, e.g. 500 300:12% 200:noele')
  return specs.map((spec, i) => {
    const fail = (why: string) => new Error(`stretch ${i + 1} "${spec}": ${why}`)
    const parts = spec.split(':')
    if (parts.length > 2) throw fail('expected LENGTH, LENGTH:GRADE% or LENGTH:noele')
    const length = Number(parts[0])
    if (!Number.isFinite(length) || length <= 0) throw fail('length must be a positive number of metres')
    if (parts.length === 1) return { length, grade: 0 }
    if (parts[1] === 'noele') return { length, grade: null }
    const grade = Number(parts[1].replace(/%$/, ''))
    if (parts[1] === '' || !Number.isFinite(grade)) throw fail('grade must be a percentage or noele')
    return { length, grade }
  })
}

// One point every 10 m along a straight line. A noele stretch's points carry no elevation; the
// next graded stretch climbs from the last elevation known.
export function routePoints(stretches: Stretch[], start: RouteStart): RoutePoint[] {
  const points: RoutePoint[] = [{ lat: start.lat, lng: start.lng, ele: start.ele }]
  let at: LatLng = start
  let ele = start.ele
  for (const stretch of stretches) {
    const steps = Math.ceil(stretch.length / POINT_SPACING_M)
    const step = stretch.length / steps
    for (let k = 1; k <= steps; k++) {
      at = destination(at, start.bearing, step)
      if (stretch.grade !== null) ele += (step * stretch.grade) / 100
      points.push({ lat: at.lat, lng: at.lng, ele: stretch.grade === null ? null : ele })
    }
  }
  return points
}

export function gpxFileName(name: string): string {
  return `${slug(devcheckName(name))}.gpx`
}
