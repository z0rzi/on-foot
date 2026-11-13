import { lineFocus, type LineFocusInput } from '../lineFocus'
import { overviewItems } from '../overviewItems'
import type { OverviewGeometry } from '../../../data/geo/overview'

const trail = (id: number) => ({ id })
const activity = (id: number, linkedTrailId: number | null, startedAt = id) => ({ id, linkedTrailId, startedAt })

const idle: LineFocusInput = {
  trails: [trail(1), trail(2)],
  activities: [activity(10, 1), activity(11, 1), activity(12, 2), activity(13, null)],
  toggles: { trails: true, activities: true },
  selection: null,
  loadedRoute: null,
  phase: 'idle',
}

const shownClasses = (toggles: LineFocusInput['toggles']) => lineFocus({ ...idle, toggles }).shownClasses

describe('the classes of line shown (D104)', () => {
  it('shows every trail and the activities tied to no trail with both kinds on, leaving linked ones out', () =>
    expect(shownClasses({ trails: true, activities: true })).toEqual(['trail', 'activity']))

  it('shows every trail with activities off', () =>
    expect(shownClasses({ trails: true, activities: false })).toEqual(['trail']))

  it('shows every activity, linked or not, with trails off', () =>
    expect(shownClasses({ trails: false, activities: true })).toEqual(['activity', 'linkedActivity']))

  it('shows nothing with both off', () =>
    expect(shownClasses({ trails: false, activities: false })).toEqual([]))

  it('a toggle hides its lines through the focus alone: every row stays an item of the lines (D124)', () => {
    const line = '{"type":"MultiLineString","coordinates":[[[6.1,45.1],[6.2,45.2]]]}' as OverviewGeometry
    const rows = {
      trails: [{ id: 1, overviewGeometry: line }],
      activities: [{ id: 10, linkedTrailId: 1, startedAt: 10, overviewGeometry: line }],
    }
    const items = overviewItems(rows.trails, rows.activities)
    const trailsOff = lineFocus({ ...idle, ...rows, toggles: { trails: false, activities: true } })
    expect(items.map((i) => i.key)).toEqual(['trail-1', 'activity-10'])
    expect(trailsOff.shownClasses).toEqual(['activity', 'linkedActivity'])
  })
})

describe('the focus, by state (the spec state table)', () => {
  it('idle with nothing selected: the rest at full strength, no family, nothing left out', () =>
    expect(lineFocus(idle)).toMatchObject({ familyKeys: [], leftOutKey: null, restDimmed: false }))

  it('a trail selected: its family is the trail and its activities, the trail left out, the rest dimmed', () => {
    const selected = { kind: 'trail', id: 1 } as const
    expect(lineFocus({ ...idle, selection: selected, loadedRoute: selected })).toMatchObject({
      familyKeys: ['trail-1', 'activity-11', 'activity-10'],
      leftOutKey: 'trail-1',
      restDimmed: true,
    })
  })

  it('a linked activity selected: its trail and every sibling are its family, the activity left out', () => {
    const selected = { kind: 'activity', id: 10 } as const
    expect(lineFocus({ ...idle, selection: selected, loadedRoute: selected })).toMatchObject({
      familyKeys: ['trail-1', 'activity-11', 'activity-10'],
      leftOutKey: 'activity-10',
      restDimmed: true,
    })
  })

  it('an activity tied to no trail selected: it is drawn alone', () => {
    const selected = { kind: 'activity', id: 13 } as const
    expect(lineFocus({ ...idle, selection: selected, loadedRoute: selected }).familyKeys).toEqual(['activity-13'])
  })

  it('an activity whose trail was deleted under it is drawn alone, as one tied to no trail', () => {
    const selected = { kind: 'activity', id: 12 } as const
    const trailGone = { ...idle, trails: [trail(1)], selection: selected, loadedRoute: selected }
    expect(lineFocus(trailGone).familyKeys).toEqual(['activity-12'])
  })

  it('draws the family whatever the toggles say (D109)', () => {
    const selected = { kind: 'trail', id: 1 } as const
    const bothOff = { ...idle, toggles: { trails: false, activities: false }, selection: selected, loadedRoute: selected }
    expect(lineFocus(bothOff)).toMatchObject({ shownClasses: [], familyKeys: ['trail-1', 'activity-11', 'activity-10'] })
  })
})

describe('while recording (D114)', () => {
  const followed = { kind: 'trail', id: 1 } as const

  it.each(['recording', 'paused'] as const)('%s: the overview dimmed, the followed trail left out, no family', (phase) =>
    expect(lineFocus({ ...idle, selection: followed, loadedRoute: followed, phase })).toMatchObject({
      familyKeys: [],
      leftOutKey: 'trail-1',
      restDimmed: true,
    }))

  it('with no trail followed, the overview dimmed and nothing left out', () =>
    expect(lineFocus({ ...idle, phase: 'recording' })).toMatchObject({ familyKeys: [], leftOutKey: null, restDimmed: true }))
})

describe('no blink on selection (D132)', () => {
  it('keeps the selected item in its family, left out of nothing, until its route has loaded', () => {
    const focus = lineFocus({ ...idle, selection: { kind: 'trail', id: 2 }, loadedRoute: null })
    expect(focus.familyKeys).toContain('trail-2')
    expect(focus.leftOutKey).toBeNull()
  })
})
