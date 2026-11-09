import type { EdgePadding } from './provider/types'
import type { PillKind } from './pillContent'
import type { SheetRest } from './sheetRest'
import { MapTokens } from '../theme/tokens'

// The pill's bottom edge, measured from the top of the Map, and the state it was measured in.
export interface PillMeasure {
  kind: PillKind
  bottom: number
}

// The camera's padding for fitting and following: the subject stays below the pill (or the status
// bar when there is none) and above the resting card: the top of the collapsed graph card, graph
// included, or of the nav card, the card's bottom margin counted. Not settled while the shown pill
// has not been measured yet; a fit waits for it, so it never lands under the pill.
export function cameraPadding({
  topInset,
  pill,
  sheet,
}: {
  topInset: number
  pill: { kind: PillKind; measured: PillMeasure | null }
  sheet: SheetRest
}): { padding: EdgePadding; settled: boolean } {
  const { cameraEdgeMargin: margin, cameraSidePadding: sides } = MapTokens
  const pillBottom = pill.kind !== 'none' && pill.measured?.kind === pill.kind ? pill.measured.bottom : null
  const settled = pill.kind === 'none' || pillBottom != null
  return {
    padding: [(pillBottom ?? topInset) + margin, sides, sheet.covered + margin, sides],
    settled,
  }
}
