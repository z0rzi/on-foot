import type { OverviewPress } from '../provider/types'
import { metersPerDp } from '../provider/zoom'
import type { Selection } from '../../store/mapStore'
import type { RecordingPhase } from '../../recording/recordingPhase'
import type { TrailOverviewRow } from '../../data/trails/types'
import { metersToSegment, OVERVIEW_TOLERANCE_METERS, type StartPoint } from '../../data/geo/overview'
import { formatDistance } from '../../format/units'
import { boundsForPoints, type LngLatBounds } from '../geo'
import { overviewKey } from './overviewItems'

type Row = Pick<TrailOverviewRow, 'id' | 'name' | 'overviewGeometry' | 'start'> & {
  metrics: Pick<TrailOverviewRow['metrics'], 'distanceMeters'>
}

export interface PressInput {
  trails: readonly Row[]
  activities: readonly Row[]
  selection: Selection | null
  phase: RecordingPhase
  // The zoom past which clusters no longer split (D117).
  clusterCap: number
  // How far from the finger a press finds the overview (dp), the provider's query box (D126).
  pressTolerance: number
}

// What a press on the overview does: select an item, clear the selection, fit the camera to the
// starts under the finger, list the items there, name an item in a toast while recording, or nothing.
export type PressOutcome =
  | { kind: 'none' }
  | { kind: 'select'; selection: Selection }
  | { kind: 'deselect' }
  | { kind: 'fit'; bounds: LngLatBounds; maxZoom: number }
  | { kind: 'list'; items: Selection[] }
  | { kind: 'name'; key: string; text: string }

interface Entry {
  selection: Selection
  row: Row
}

interface Pinned {
  selection: Selection
  start: StartPoint
}

interface Candidate {
  entry: Entry
  meters: number
}

const NONE: PressOutcome = { kind: 'none' }
const DESELECT: PressOutcome = { kind: 'deselect' }

// The rows by key, the selected item left out: it is never picked, so a press on it falls through.
function entries(input: PressInput): Map<string, Entry> {
  const byKey = new Map<string, Entry>()
  const add = (kind: Selection['kind'], row: Row) => {
    if (input.selection?.kind === kind && input.selection.id === row.id) return
    byKey.set(overviewKey(kind, row.id), { selection: { kind, id: row.id }, row })
  }
  for (const t of input.trails) add('trail', t)
  for (const a of input.activities) add('activity', a)
  return byKey
}

const toPosition = ([lng, lat]: number[]): StartPoint => ({ lat, lng })

// The distance from the point to the nearest of the line's segments; a geometry that cannot be read
// is at no distance at all.
function metersToLine(point: StartPoint, geometry: string): number {
  let lines: number[][][]
  try {
    lines = (JSON.parse(geometry) as { coordinates: number[][][] }).coordinates
  } catch {
    return Infinity
  }
  if (!Array.isArray(lines)) return Infinity
  let nearest = Infinity
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      nearest = Math.min(nearest, metersToSegment(point, toPosition(line[i - 1]), toPosition(line[i])))
    }
  }
  return nearest
}

function candidates(keys: Iterable<string>, byKey: Map<string, Entry>, meters: (entry: Entry) => number): Candidate[] {
  const list: Candidate[] = []
  for (const key of new Set(keys)) {
    const entry = byKey.get(key)
    if (entry == null) continue
    const distance = meters(entry)
    if (Number.isFinite(distance)) list.push({ entry, meters: distance })
  }
  return list
}

// The items whose pin is under the finger, alone or in a cluster, each once, trails first and in the
// rows' order.
function pinned(press: OverviewPress, byKey: Map<string, Entry>): Pinned[] {
  const hit = new Set([...press.pins, ...press.clusters.flatMap((c) => c.keys)])
  const list: Pinned[] = []
  for (const [key, { selection, row }] of byKey) {
    if (hit.has(key) && row.start != null) list.push({ selection, start: row.start })
  }
  return list
}

// One pin is selected. Several: below the cap, with a cluster among them that splits by the cap,
// their starts are fitted with the cap as the zoom limit; otherwise they are listed, so the camera
// never zooms in to tell apart starts that stay merged (D118).
function pinsOutcome(press: OverviewPress, pins: Pinned[], cap: number): PressOutcome {
  if (pins.length === 1) return { kind: 'select', selection: pins[0].selection }
  const bounds = boundsForPoints(pins.map((p) => p.start))
  const splits = press.clusters.some((c) => c.splitZoom <= cap)
  if (splits && press.zoom < cap && bounds != null) return { kind: 'fit', bounds, maxZoom: cap }
  return { kind: 'list', items: pins.map((p) => p.selection) }
}

const nearestOf = (list: Candidate[]): Candidate | null =>
  list.reduce<Candidate | null>((best, c) => (best == null || c.meters < best.meters ? c : best), null)

// The nearest line, a trail over an activity where they are equally near. Lines nearer to each other
// than the overview geometry's own tolerance cannot be told apart by it, so they count as equal.
function nearestLine(list: Candidate[]): Candidate | null {
  const nearest = nearestOf(list)
  if (nearest == null || nearest.entry.selection.kind === 'trail') return nearest
  const trails = list.filter((c) => c.entry.selection.kind === 'trail' && c.meters < nearest.meters + OVERVIEW_TOLERANCE_METERS)
  return nearestOf(trails) ?? nearest
}

function lineUnderFinger(press: OverviewPress, byKey: Map<string, Entry>): Candidate | null {
  const point = toPosition(press.point)
  return nearestLine(candidates(press.lines, byKey, (e) => metersToLine(point, e.row.overviewGeometry ?? '')))
}

const hitNothing = (press: OverviewPress): boolean =>
  press.pins.length === 0 && press.lines.length === 0 && press.clusters.length === 0

// Whether the press is off the selected route, whose line may have left the overview (D132): farther
// from its overview geometry than the press reaches at the press's zoom, plus the geometry's own
// tolerance, which the route lies within. Not off a route that is not there or whose place is unknown.
function offSelectedRoute(press: OverviewPress, input: PressInput): boolean {
  const { selection } = input
  if (selection == null) return false
  const rows = selection.kind === 'trail' ? input.trails : input.activities
  const geometry = rows.find((row) => row.id === selection.id)?.overviewGeometry
  if (geometry == null) return false
  const meters = metersToLine(toPosition(press.point), geometry)
  const reach = input.pressTolerance * metersPerDp(press.point[1], press.zoom) + OVERVIEW_TOLERANCE_METERS
  return Number.isFinite(meters) && meters > reach
}

// Pins win over lines, a cluster's pins counting as pins under the finger: one is selected, several
// fitted or listed. Among lines, the nearest. A press that hit nothing, off the selected route,
// clears the selection. While recording, the line is named and nothing selected or cleared (D112,
// D114, D118, D139). Keys no row has are ignored.
export function resolvePress(press: OverviewPress, input: PressInput): PressOutcome {
  const byKey = entries(input)
  if (input.phase !== 'idle') {
    const line = lineUnderFinger(press, byKey)
    if (line == null) return NONE
    const { row, selection } = line.entry
    return { kind: 'name', key: overviewKey(selection.kind, row.id), text: `${row.name} · ${formatDistance(row.metrics.distanceMeters)}` }
  }
  const pins = pinned(press, byKey)
  if (pins.length > 0) return pinsOutcome(press, pins, input.clusterCap)
  const line = lineUnderFinger(press, byKey)
  if (line != null) return { kind: 'select', selection: line.entry.selection }
  return hitNothing(press) && offSelectedRoute(press, input) ? DESELECT : NONE
}
