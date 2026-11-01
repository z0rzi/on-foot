import { LocationFix } from '../location'
import { haversineMeters } from '../data/geo/metrics'
import { formatClockSeconds } from '../activities/format'
import type { Anchor, GateResult } from './fixGate'

// Accuracy and a distance are enough to recognise a bad fix; a coordinate would turn the log into a
// record of where the user has been, which it must never be. The distance is measured to the first
// fix in the segment, gated or not, so a rejected jump still shows its size.
export function fixBatchSummary(
  arrived: LocationFix[],
  inSegment: LocationFix[],
  gate: GateResult,
  anchor: Anchor | null,
): Record<string, unknown> {
  const accuracies = arrived.map((f) => f.accuracy).filter((a): a is number => a !== null)
  const first = inSegment[0] ?? null
  return {
    arrived: arrived.length,
    kept: gate.kept.length,
    droppedBeforeSegment: arrived.length - inSegment.length,
    droppedAccuracy: gate.droppedAccuracy,
    droppedJump: gate.droppedJump,
    recovered: gate.recovered,
    firstAt: arrived.length ? formatClockSeconds(arrived[0].t) : null,
    lastAt: arrived.length ? formatClockSeconds(arrived[arrived.length - 1].t) : null,
    bestAccuracy: accuracies.length ? Math.min(...accuracies) : null,
    worstRejectedAccuracy: gate.worstRejectedAccuracy,
    worstJump: gate.worstJump && {
      metres: Math.round(gate.worstJump.metres),
      allowedMetres: Math.round(gate.worstJump.allowedMetres),
      seconds: gate.worstJump.seconds,
    },
    metresFromAnchor:
      anchor && first ? Math.round(haversineMeters(anchor.lat, anchor.lng, first.lat, first.lng)) : null,
  }
}
