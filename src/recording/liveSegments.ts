import { groupPointsBySegment } from '../data/activities/mapping'
import type { LiveTrackPoint, TrackPoint } from '../data/activities/types'

let cached: { livePoints: LiveTrackPoint[]; segments: TrackPoint[][] } | null = null

// The one derivation of the live track's segments. The store replaces `livePoints` whenever the
// track changes, so its identity keys the cache and every reader shares one grouping per change.
export function selectLiveSegments(state: { livePoints: LiveTrackPoint[] }): TrackPoint[][] {
  if (cached?.livePoints !== state.livePoints) {
    cached = { livePoints: state.livePoints, segments: groupPointsBySegment(state.livePoints) }
  }
  return cached.segments
}
