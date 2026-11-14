// A style choice as the quick-switch logic needs to see it: an id plus the semantic satellite
// marker declared on the provider port. Callers pass the provider's style list in, so no provider
// style id is ever hardcoded here.
export interface StyleChoice {
  id: string
  satellite?: boolean
}

// The cold-start fallback for quick-switch when there is no usable previous layer: from any
// non-satellite layer, switch to the satellite one; from satellite, switch to the first
// non-satellite layer in the list. Degenerate lists (no satellite / no non-satellite) leave the
// style unchanged by returning the current id.
function satelliteToggleTarget(currentId: string, styles: StyleChoice[]): string {
  const current = styles.find((s) => s.id === currentId)
  const target = current?.satellite
    ? styles.find((s) => !s.satellite)
    : styles.find((s) => s.satellite)
  return target?.id ?? currentId
}

// Resolve the quick-switch (swipe) target: the previously selected layer when it is still a
// valid, different, in-list choice (the A/B toggle); otherwise the satellite-toggle fallback.
export function resolveQuickSwitch(
  currentId: string,
  previousId: string | null,
  styles: StyleChoice[],
): string {
  if (previousId && previousId !== currentId && styles.some((s) => s.id === previousId)) {
    return previousId
  }
  return satelliteToggleTarget(currentId, styles)
}
