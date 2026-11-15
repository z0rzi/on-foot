import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { evidenceDir } from './evidence'
import { buildRoute } from './geometry'
import { writeGpx } from './gpx'
import { devcheckName } from './devcheckData'
import { DEFAULT_ROUTE_START, gpxFileName, parseStretches, routePoints, type RouteStart } from './routeSpec'

export function writeRoute(name: string, stretches: string[], start: Partial<RouteStart>): string {
  const points = routePoints(parseStretches(stretches), { ...DEFAULT_ROUTE_START, ...start })
  const length = buildRoute(points).length
  const path = join(evidenceDir(), gpxFileName(name))
  writeFileSync(path, writeGpx(devcheckName(name), points))
  return `${path}\n${Math.round(length)} m, ${points.length} points, named "${devcheckName(name)}"`
}
