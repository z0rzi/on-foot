import type { OverviewLineSlot } from '../../provider/stacking'

// The ids of the overview's sources and layers on the map, named once: they draw the overview and a
// press finds its hits in them.
export const OVERVIEW_SOURCES = { lines: 'overview-lines-source', pins: 'overview-pins-source' } as const

export const overviewLineLayerId = (slot: OverviewLineSlot): string => `overview-lines-${slot}`

export const PIN_LAYERS = {
  tag: 'overview-pin-tag',
  shadow: 'overview-pin-shadow',
  outline: 'overview-pin-outline',
  body: 'overview-pin-body',
  bodyRight: 'overview-pin-body-right',
  centre: 'overview-pin-centre',
  cluster: 'overview-cluster',
  clusterCount: 'overview-cluster-count',
  room: 'overview-pin-room',
} as const
