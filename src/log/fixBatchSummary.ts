import { LocationFix } from '../location'
import { haversineMeters } from '../data/geo/metrics'
import { formatClockSeconds } from '../activities/format'

// Accuracy and a distance are enough to recognise a bad fix; a coordinate would turn the log into a
// record of where the user has been, which it must never be.
export function fixBatchSummary(
  arrived: LocationFix[],
  kept: LocationFix[],
  previous: { lat: number; lng: number } | null,
): Record<string, unknown> {
  const accuracies = arrived.map((f) => f.accuracy).filter((a): a is number => a !== null)
  const first = kept[0] ?? null
  return {
    arrived: arrived.length,
    kept: kept.length,
    dropped: arrived.length - kept.length,
    firstAt: arrived.length ? formatClockSeconds(arrived[0].t) : null,
    lastAt: arrived.length ? formatClockSeconds(arrived[arrived.length - 1].t) : null,
    bestAccuracy: accuracies.length ? Math.min(...accuracies) : null,
    metresFromPrevious:
      previous && first ? Math.round(haversineMeters(previous.lat, previous.lng, first.lat, first.lng)) : null,
  }
}
