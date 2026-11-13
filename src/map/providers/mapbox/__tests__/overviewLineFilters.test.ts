import { overviewLineFilters } from '../overviewLineFilters'
import { OVERVIEW_LINE_SLOTS, type OverviewLineSlot } from '../../../provider/stacking'
import type { OverviewClass, OverviewLineFocus } from '../../../provider/types'

type Feature = { key: string; class: OverviewClass }

// Mapbox's semantics for the operators the filters use.
function evaluate(expression: unknown, feature: Feature): unknown {
  if (!Array.isArray(expression)) return expression
  const [op, ...args] = expression as [string, ...unknown[]]
  switch (op) {
    case 'literal': return args[0]
    case 'get': return feature[args[0] as keyof Feature]
    case 'in': return (evaluate(args[1], feature) as unknown[]).includes(evaluate(args[0], feature))
    case 'all': return args.every((arg) => evaluate(arg, feature) === true)
    case '!': return evaluate(args[0], feature) !== true
    default: throw new Error(`operator not modelled: ${op}`)
  }
}

// The slots drawing the feature, bottom to top.
function slotsOf(focus: OverviewLineFocus, feature: Feature): OverviewLineSlot[] {
  const filters = overviewLineFilters(focus)
  return OVERVIEW_LINE_SLOTS.filter((slot) => evaluate(filters[slot], feature) === true)
}

const trail1 = { key: 'trail-1', class: 'trail' } as const
const linked10 = { key: 'activity-10', class: 'linkedActivity' } as const
const trail2 = { key: 'trail-2', class: 'trail' } as const
const loose13 = { key: 'activity-13', class: 'activity' } as const
const features: Feature[] = [trail1, linked10, trail2, loose13]

const idle: OverviewLineFocus = { shownClasses: ['trail', 'activity'], familyKeys: [], leftOutKey: null, restDimmed: false }
const selected: OverviewLineFocus = { ...idle, familyKeys: ['trail-1', 'activity-10'], leftOutKey: 'trail-1', restDimmed: true }

describe('the overview line filters', () => {
  it('draws the shown classes at full strength with nothing selected, and hides the others', () => {
    expect(features.map((f) => slotsOf(idle, f))).toEqual([['shown'], [], ['shown'], ['shown']])
  })

  it('draws the family above the dimmed rest, and leaves the selected item out', () => {
    expect(features.map((f) => slotsOf(selected, f))).toEqual([[], ['family'], ['dimmed'], ['dimmed']])
  })

  it('draws a family member of a hidden class, and never one of them in the rest', () => {
    const bothOff = { ...selected, shownClasses: [] }
    expect(features.map((f) => slotsOf(bothOff, f))).toEqual([[], ['family'], [], []])
  })

  it('keeps the selected item in its family until it is left out', () => {
    expect(slotsOf({ ...selected, leftOutKey: null }, trail1)).toEqual(['family'])
  })

  it('leaves a recording\'s followed trail out of the dimmed rest', () => {
    const recording = { ...idle, leftOutKey: 'trail-2', restDimmed: true }
    expect(features.map((f) => slotsOf(recording, f))).toEqual([['dimmed'], [], [], ['dimmed']])
  })
})
