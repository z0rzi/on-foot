interface HydrationSignals {
  // The store library reported a completed hydration.
  hydrated: boolean
  // The store library reported a hydration error.
  failed: boolean
  // The bounded wait has passed.
  timedOut: boolean
}

type HydrationGate = 'wait' | 'hydrated' | 'failed' | 'timed-out'

// Whether the map may mount: once the map store has hydrated, or, so a broken storage never holds
// the app, as soon as hydration fails or the bounded wait passes. A hydration that did complete
// wins over the bound, so the launch reads the restored state whenever it has it.
export function hydrationGate({ hydrated, failed, timedOut }: HydrationSignals): HydrationGate {
  if (hydrated) return 'hydrated'
  if (failed) return 'failed'
  if (timedOut) return 'timed-out'
  return 'wait'
}
