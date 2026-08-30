// Moving time = wall time from start to end, minus accumulated paused time, never negative.
// The single definition shared by the live recording clock and the saved activity's duration.
export function movingDurationMs(startedAt: number, end: number, pausedMs: number): number {
  return Math.max(0, end - startedAt - pausedMs)
}
