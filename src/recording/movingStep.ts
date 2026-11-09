const STATIONARY_SPEED_MPS = 0.5 / 3.6

// Which steps of a track are walking: a step slower than walking pace is a stop, not track.
export function isMovingStep(meters: number, seconds: number): boolean {
  return meters > 0 && meters >= STATIONARY_SPEED_MPS * seconds
}
