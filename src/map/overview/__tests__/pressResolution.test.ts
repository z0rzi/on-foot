import { resolvePress, type PressInput } from '../pressResolution'
import type { OverviewPress } from '../../provider/types'
import type { OverviewGeometry } from '../../../data/geo/overview'

// Around 45.9° N, 0.0001° of latitude is about 11 m and 0.0001° of longitude about 7.7 m.
const LAT = 45.9
const POINT: [number, number] = [7, LAT]

// A north–south line `metres` east of the press point.
const lineEast = (metres: number): OverviewGeometry => {
  const lng = 7 + metres / 77300
  return JSON.stringify({ type: 'MultiLineString', coordinates: [[[lng, LAT - 0.001], [lng, LAT + 0.001]]] }) as OverviewGeometry
}
const startEast = (metres: number) => ({ lat: LAT, lng: 7 + metres / 77300 })

const trail = (id: number, metres: number, distanceMeters = 5100) => ({
  id, name: `Trail ${id}`, overviewGeometry: lineEast(metres), start: startEast(metres), metrics: { distanceMeters },
})
const activity = (id: number, metres: number, distanceMeters = 11000) => ({
  id, name: `Walk ${id}`, overviewGeometry: lineEast(metres), start: startEast(metres), metrics: { distanceMeters },
})

const input: PressInput = {
  trails: [trail(1, 5), trail(2, 45), trail(3, 60)],
  activities: [activity(10, 0), activity(11, 30), activity(12, 100)],
  selection: null,
  phase: 'idle',
  clusterCap: 17,
  pressTolerance: 22,
}

const press = (hits: Partial<Omit<OverviewPress, 'point'>>): OverviewPress => ({
  point: POINT, zoom: 12, pins: [], lines: [], clusters: [], ...hits,
})

// A cluster that splits below the cap, and one whose starts stay merged up to it and past it.
const cluster = (...keys: string[]) => ({ keys, splitZoom: 15 })
const merged = (...keys: string[]) => ({ keys, splitZoom: 18 })

const selects = (kind: 'trail' | 'activity', id: number) => ({ kind: 'select', selection: { kind, id } })
const NONE = { kind: 'none' }

describe('what a tap on the overview picks (D112)', () => {
  it('picks nothing when nothing of the overview is under the finger', () =>
    expect(resolvePress(press({}), input)).toEqual(NONE))

  it('prefers a pin over a line, even a nearer one', () =>
    expect(resolvePress(press({ pins: ['trail-3'], lines: ['activity-10'] }), input)).toEqual(selects('trail', 3)))

  it('among lines, takes the nearest to the finger', () =>
    expect(resolvePress(press({ lines: ['trail-3', 'activity-11', 'trail-2'] }), input)).toEqual(selects('activity', 11)))

  it('at equal distance, takes a trail over an activity: closer than the overview’s tolerance is equal', () =>
    expect(resolvePress(press({ lines: ['activity-10', 'trail-1'] }), input)).toEqual(selects('trail', 1)))

  it('takes an activity well nearer than a trail', () =>
    expect(resolvePress(press({ lines: ['trail-2', 'activity-10'] }), input)).toEqual(selects('activity', 10)))
})

const lists = (...items: { kind: 'trail' | 'activity'; id: number }[]) => ({ kind: 'list', items })
const fits = (west: number, east: number) => ({
  kind: 'fit',
  bounds: { ne: [startEast(east).lng, LAT], sw: [startEast(west).lng, LAT] },
  maxZoom: 17,
})

describe('what a tap on a cluster or on several pins does (D118)', () => {
  it('below the cap, fits a cluster’s starts with the cap as the zoom limit, over the line under it', () =>
    expect(resolvePress(press({ clusters: [cluster('trail-3', 'activity-12')], lines: ['activity-10'] }), input)).toEqual(
      fits(60, 100),
    ))

  it('below the cap, fits every start under the finger: the clusters’ and a pin beside them', () =>
    expect(resolvePress(press({ clusters: [cluster('trail-3'), cluster('activity-12')], pins: ['activity-11'] }), input)).toEqual(
      fits(30, 100),
    ))

  it('below the cap, lists a cluster whose starts would stay merged at the cap: the camera never zooms in to part them', () =>
    expect(resolvePress(press({ clusters: [merged('activity-12', 'trail-3')] }), input)).toEqual(
      lists({ kind: 'trail', id: 3 }, { kind: 'activity', id: 12 }),
    ))

  it('at the cap, lists a cluster’s items, trails first', () =>
    expect(resolvePress(press({ zoom: 17, clusters: [cluster('activity-12', 'trail-3', 'activity-11')] }), input)).toEqual(
      lists({ kind: 'trail', id: 3 }, { kind: 'activity', id: 11 }, { kind: 'activity', id: 12 }),
    ))

  it('past the cap, lists every item under the finger, a pin beside the cluster included', () =>
    expect(resolvePress(press({ zoom: 19.5, clusters: [cluster('trail-3', 'activity-12')], pins: ['trail-2'] }), input)).toEqual(
      lists({ kind: 'trail', id: 2 }, { kind: 'trail', id: 3 }, { kind: 'activity', id: 12 }),
    ))

  it('lists several pins under the finger, below the cap too', () =>
    expect(resolvePress(press({ pins: ['activity-11', 'trail-3'], lines: ['activity-10'] }), input)).toEqual(
      lists({ kind: 'trail', id: 3 }, { kind: 'activity', id: 11 }),
    ))

  it('selects the one item left when the others’ keys are stale', () => {
    expect(resolvePress(press({ clusters: [cluster('trail-3', 'trail-99')] }), input)).toEqual(selects('trail', 3))
    expect(resolvePress(press({ zoom: 18, pins: ['activity-77', 'activity-11'] }), input)).toEqual(selects('activity', 11))
  })

  it('falls through to the lines when no key of a cluster is known', () =>
    expect(resolvePress(press({ clusters: [cluster('trail-98', 'trail-99')], lines: ['trail-2'] }), input)).toEqual(
      selects('trail', 2),
    ))
})

describe('the selected item is never picked (D112)', () => {
  const selected: PressInput = { ...input, selection: { kind: 'activity', id: 10 } }

  it('lets a tap on its own line fall through to the line under it', () =>
    expect(resolvePress(press({ lines: ['activity-10', 'trail-2'] }), selected)).toEqual(selects('trail', 2)))

  it('keeps the selection when nothing else is under the finger', () =>
    expect(resolvePress(press({ lines: ['activity-10'] }), selected)).toEqual(NONE))

  it('skips its pin too, down to the lines', () =>
    expect(resolvePress(press({ pins: ['activity-10'], lines: ['trail-3'] }), selected)).toEqual(selects('trail', 3)))
})

// At 45.9° N one dp is about 0.83 m at zoom 16 and 1.66 m at zoom 15, so with 22 dp and the overview
// geometry's 10 m the selected route reaches about 28 m and 47 m from the finger.
describe('a tap on nothing (D139)', () => {
  const DESELECT = { kind: 'deselect' }
  const selecting = (selection: PressInput['selection']): PressInput => ({ ...input, selection })

  it('clears the selection when the finger is off its route', () =>
    expect(resolvePress(press({ zoom: 16 }), selecting({ kind: 'trail', id: 3 }))).toEqual(DESELECT))

  it('keeps the selection when the finger is on its route, whose line left the overview', () =>
    expect(resolvePress(press({ zoom: 16 }), selecting({ kind: 'activity', id: 10 }))).toEqual(NONE))

  it('reaches the selected route by the press tolerance at the press’s zoom', () => {
    const thirtyMetresAway = selecting({ kind: 'activity', id: 11 })
    expect(resolvePress(press({ zoom: 15 }), thirtyMetresAway)).toEqual(NONE)
    expect(resolvePress(press({ zoom: 16 }), thirtyMetresAway)).toEqual(DESELECT)
  })

  it('does nothing with nothing selected', () => expect(resolvePress(press({ zoom: 16 }), input)).toEqual(NONE))

  it('does nothing when it hit something, even what no row has', () => {
    const farFromIt = selecting({ kind: 'trail', id: 3 })
    expect(resolvePress(press({ zoom: 16, pins: ['trail-99'] }), farFromIt)).toEqual(NONE)
    expect(resolvePress(press({ zoom: 16, lines: ['activity-77'] }), farFromIt)).toEqual(NONE)
    expect(resolvePress(press({ zoom: 16, clusters: [cluster('trail-98', 'trail-99')] }), farFromIt)).toEqual(NONE)
  })

  it('keeps the selection while where its route lies is unknown', () => {
    const broken = { ...trail(3, 60), overviewGeometry: '{"type":' as OverviewGeometry }
    expect(resolvePress(press({ zoom: 16 }), { ...selecting({ kind: 'trail', id: 3 }), trails: [broken] })).toEqual(NONE)
    expect(resolvePress(press({ zoom: 16 }), { ...selecting({ kind: 'trail', id: 3 }), trails: [{ ...broken, overviewGeometry: null }] })).toEqual(NONE)
    expect(resolvePress(press({ zoom: 16 }), selecting({ kind: 'trail', id: 42 }))).toEqual(NONE)
  })

  it('never deselects while recording or paused: the selection is the followed trail', () => {
    const followed = selecting({ kind: 'trail', id: 3 })
    expect(resolvePress(press({ zoom: 16 }), { ...followed, phase: 'recording' })).toEqual(NONE)
    expect(resolvePress(press({ zoom: 16 }), { ...followed, phase: 'paused' })).toEqual(NONE)
  })
})

describe('stale or broken hits (D126, Failure modes)', () => {
  it('ignores keys no row has: the lines and pins files switch apart', () => {
    expect(resolvePress(press({ pins: ['trail-99'], lines: ['activity-77'] }), input)).toEqual(NONE)
    expect(resolvePress(press({ pins: ['trail-99'], lines: ['trail-3'] }), input)).toEqual(selects('trail', 3))
  })

  it('ignores a hit line whose geometry cannot be read, and a pin with no start', () => {
    const broken = { ...trail(1, 5), overviewGeometry: '{"type":' as OverviewGeometry, start: null }
    const withBroken: PressInput = { ...input, trails: [broken, trail(2, 45)] }
    expect(resolvePress(press({ pins: ['trail-1'], lines: ['trail-1', 'trail-2'] }), withBroken)).toEqual(selects('trail', 2))
  })
})

describe('while recording (D114)', () => {
  const recording: PressInput = { ...input, phase: 'recording', selection: { kind: 'trail', id: 1 } }

  it('names the nearest line instead of selecting it', () =>
    expect(resolvePress(press({ lines: ['trail-3', 'activity-11'] }), recording)).toEqual({
      kind: 'name', key: 'activity-11', text: 'Walk 11 · 11.0 km',
    }))

  it('names nothing for the followed trail, the selection', () =>
    expect(resolvePress(press({ lines: ['trail-1'] }), recording)).toEqual(NONE))

  it('names while paused too', () =>
    expect(resolvePress(press({ lines: ['trail-3'] }), { ...recording, phase: 'paused' })).toEqual({
      kind: 'name', key: 'trail-3', text: 'Trail 3 · 5.1 km',
    }))
})
