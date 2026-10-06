import { useEffect, useRef, useState } from 'react'
import { logEvent } from '../log'
import { LoadOutcome, LoadedState, resolveLoad } from './loadedEntity'

export function useLoadedEntity<T>(
  id: number | null,
  load: (id: number) => Promise<T | null>,
  options: { label: string; version?: number; onUnavailable?: (reason: 'missing' | 'error') => void },
): LoadOutcome<T> {
  const { label, version = 0, onUnavailable } = options
  const [loaded, setLoaded] = useState<LoadedState<T> | null>(null)
  // Both functions are read through refs so either can be an inline arrow at the call site. A
  // function in the effect's dep array is compared by identity, so a fresh arrow each render would
  // re-run the load, and the state write that follows, forever. What the load is keyed to is the
  // entity asked for and the version that says it may have changed — not which function does the
  // asking. Written in an effect and never during render: a render React discards would still
  // mutate them, leaving a closure from a tree that was never committed.
  const loader = useRef(load)
  const unavailable = useRef(onUnavailable)
  useEffect(() => {
    loader.current = load
    unavailable.current = onUnavailable
  }, [load, onUnavailable])

  useEffect(() => {
    // Deliberately no `Number.isFinite` guard here, unlike resolveLoad: a bad id must still reach
    // `load` so the repository answers null and the caller's onUnavailable fires. Skipping the load
    // would strand the screen on a spinner with nothing to leave it.
    if (id == null) return
    let active = true
    void loader.current(id).then(
      (entity) => {
        if (entity == null) logEvent('warn', 'error', `${label} not found`, { id })
        if (!active) return
        setLoaded({ id, result: { ok: true, entity } })
        if (entity == null) unavailable.current?.('missing')
      },
      (err: unknown) => {
        // Logged before the liveness check: a rejection that lands after unmount still happened.
        logEvent('error', 'error', `${label} load failed`, { id, error: String(err) })
        if (!active) return
        setLoaded({ id, result: { ok: false } })
        unavailable.current?.('error')
      },
    )
    // A result that arrives after an id change or after unmount is dropped rather than stored.
    return () => {
      active = false
    }
  }, [id, version, label])

  return resolveLoad(id, loaded)
}
