import { pointCount } from './geo'
import { toOneDecimal } from './oneDecimal'

export type RouteTiming = { kind: 'trail' | 'activity'; points: number; ms: number }

// What a timing entry of the debug log says about a route (T-4): how big it is and how long the
// work took, never where it is.
export function routeTiming(
  kind: RouteTiming['kind'],
  segments: readonly (readonly unknown[])[],
  ms: number,
): RouteTiming {
  return { kind, points: pointCount(segments), ms: toOneDecimal(ms) }
}
