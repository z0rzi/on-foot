import type { Selection } from '../store/mapStore'

export type MapMode = 'free' | 'trail' | 'recording' | 'activity'

// The single map's mode, derived (never stored) so it can't drift from reality. Recording takes
// precedence over any selection.
export function mapMode(input: { recording: boolean; selection: Selection | null }): MapMode {
  if (input.recording) return 'recording'
  if (input.selection?.kind === 'activity') return 'activity'
  if (input.selection?.kind === 'trail') return 'trail'
  return 'free'
}

// The trail to draw on the map: the selected trail is shown both when viewing it and while
// recording (so the followed trail stays visible), never in free or activity mode.
export function trailToShow<T>(mode: MapMode, selectedTrail: T | null): T | null {
  return mode === 'trail' || mode === 'recording' ? selectedTrail : null
}
