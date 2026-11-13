import { pinList, type PinListInput } from '../pinList'

const metrics = (distanceMeters: number) => ({ distanceMeters })
const start = (lng: number) => ({ lat: 45.9, lng })
const trail = (id: number, distanceMeters = 5100) => ({ id, start: start(id), metrics: metrics(distanceMeters) })
const activity = (id: number, linkedTrailId: number | null, distanceMeters = 11000) => ({
  id, linkedTrailId, startedAt: id, start: start(id), metrics: metrics(distanceMeters),
})

const idle: PinListInput = {
  trails: [trail(1), trail(2, 12400)],
  activities: [activity(10, 2), activity(11, 2), activity(12, 2), activity(13, null)],
  toggles: { trails: true, activities: true },
  selection: null,
  loadedRoute: null,
  phase: 'idle',
}

const keys = (input: PinListInput) => pinList(input).map((p) => p.key)

describe('a pin at each start (D116)', () => {
  it('puts a trail’s pin on its start, tagged with its distance', () =>
    expect(pinList({ ...idle, trails: [trail(1)], activities: [] })).toEqual([
      { key: 'trail-1', position: [1, 45.9], kind: 'trail', tag: '5.1 km', dimmed: false, rank: 1 },
    ]))

  it('marks a trail with linked activities completed, its tag counting them, split with the activities’ colour while they are shown (D105)', () =>
    expect(pinList(idle).find((p) => p.key === 'trail-2')).toMatchObject({
      kind: 'completedTrailWithActivities',
      tag: '✓3 · 12.4 km',
    }))

  it('Activities off: a completed trail is all trail colour, its tag still counting its activities', () =>
    expect(pinList({ ...idle, toggles: { trails: true, activities: false } }).find((p) => p.key === 'trail-2')).toMatchObject({
      kind: 'completedTrail',
      tag: '✓3 · 12.4 km',
    }))

  it('tags an activity with its distance', () =>
    expect(pinList(idle).find((p) => p.key === 'activity-13')).toMatchObject({ kind: 'activity', tag: '11.0 km' }))

  it('gives no pin to a row with no start yet, and tags a pin with no distance `0 m`', () => {
    const noStart = { ...trail(1), start: null }
    const pins = pinList({ ...idle, trails: [noStart, trail(2, 0)], activities: [] })
    expect(pins.map((p) => [p.key, p.tag])).toEqual([['trail-2', '0 m']])
  })
})

describe('which items have a pin (D104, What the overview holds)', () => {
  it('both kinds on: every trail and every activity tied to no trail, one pin per family', () =>
    expect(keys(idle)).toEqual(['trail-1', 'trail-2', 'activity-13']))

  it('Activities off: no activity pin', () =>
    expect(keys({ ...idle, toggles: { trails: true, activities: false } })).toEqual(['trail-1', 'trail-2']))

  it('Trails off: every activity has its own pin, linked or not', () =>
    expect(keys({ ...idle, toggles: { trails: false, activities: true } })).toEqual([
      'activity-10', 'activity-11', 'activity-12', 'activity-13',
    ]))

  it('both off: no pin at all', () =>
    expect(pinList({ ...idle, toggles: { trails: false, activities: false } })).toEqual([]))

  it('an activity whose trail was deleted under it has its own pin', () =>
    expect(keys({ ...idle, trails: [trail(1)] })).toEqual(['trail-1', 'activity-10', 'activity-11', 'activity-12', 'activity-13']))
})

describe('pins by state (the spec state table)', () => {
  const pin = (input: PinListInput, key: string) => pinList(input).find((p) => p.key === key)

  it('nothing selected: no pin dimmed', () =>
    expect(pinList(idle).every((p) => !p.dimmed)).toBe(true))

  it('the selected item has no pin once its route is drawn, its start being the route’s endpoint', () => {
    const selected = { kind: 'trail', id: 1 } as const
    expect(keys({ ...idle, selection: selected, loadedRoute: selected })).not.toContain('trail-1')
  })

  it('keeps the selected item’s pin until its route has loaded (D132)', () =>
    expect(keys({ ...idle, selection: { kind: 'trail', id: 1 }, loadedRoute: null })).toContain('trail-1'))

  it('something selected: the family’s pins at full strength and their tags kept first, the others dimmed', () => {
    const selected = { kind: 'activity', id: 10 } as const
    const input = { ...idle, selection: selected, loadedRoute: selected }
    expect(pin(input, 'trail-2')).toMatchObject({ dimmed: false, rank: 0 })
    expect(pin(input, 'trail-1')).toMatchObject({ dimmed: true, rank: 1 })
    expect(pin(input, 'activity-13')).toMatchObject({ dimmed: true, rank: 3 })
  })

  it('Trails off with a linked activity selected: its siblings’ pins are the family’s', () => {
    const selected = { kind: 'activity', id: 10 } as const
    const input = { ...idle, toggles: { trails: false, activities: true }, selection: selected, loadedRoute: selected }
    expect(pinList(input).map((p) => [p.key, p.dimmed, p.rank])).toEqual([
      ['activity-11', false, 0],
      ['activity-12', false, 0],
      ['activity-13', true, 3],
    ])
  })

  it.each(['recording', 'paused'] as const)('%s: no pin at all (D114)', (phase) =>
    expect(pinList({ ...idle, phase })).toEqual([]))
})

describe('the tags kept first where they collide (D136)', () => {
  it('ranks uncompleted trails, then completed trails, then activities', () =>
    expect(pinList(idle).map((p) => [p.key, p.rank])).toEqual([['trail-1', 1], ['trail-2', 2], ['activity-13', 3]]))
})
