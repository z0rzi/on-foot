import type { ComponentProps } from 'react'
import type { LineLayer } from '@rnmapbox/maps'
import type { OverviewLineSlot } from '../../provider/stacking'
import type { OverviewClass, OverviewLineFocus } from '../../provider/types'

export type OverviewLineFilter = NonNullable<ComponentProps<typeof LineLayer>['filter']>

const keyIn = (keys: readonly string[]): OverviewLineFilter => ['in', ['get', 'key'], ['literal', [...keys]]]

const rest = (classes: readonly OverviewClass[], drawnElsewhere: readonly string[]): OverviewLineFilter => [
  'all',
  ['in', ['get', 'class'], ['literal', [...classes]]],
  ['!', keyIn(drawnElsewhere)],
]

// One filter per overview line layer, so each line is drawn by at most one layer: the family, the
// rest at full strength or the rest dimmed, never by the layer that does not hold it (D127).
export function overviewLineFilters(focus: OverviewLineFocus): Record<OverviewLineSlot, OverviewLineFilter> {
  const { shownClasses, familyKeys, leftOutKey, restDimmed } = focus
  const leftOut = leftOutKey == null ? [] : [leftOutKey]
  const notRest = [...familyKeys, ...leftOut]
  return {
    dimmed: rest(restDimmed ? shownClasses : [], notRest),
    shown: rest(restDimmed ? [] : shownClasses, notRest),
    family: keyIn(familyKeys.filter((key) => key !== leftOutKey)),
  }
}
