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
  // Read through a ref so the callback can be an inline arrow at the call site: in the effect's dep
  // array it would re-run the load on every render. Written in an effect and never during render —
  // a render React discards would still mutate it, leaving a closure from a tree never committed.
  const unavailable = useRef(onUnavailable)
  useEffect(() => {
    unavailable.current = onUnavailable
  }, [onUnavailable])

  useEffect(() => {
    // Deliberately no `Number.isFinite` guard here, unlike resolveLoad: a bad id must still reach
    // `load` so the repository answers null and the caller's onUnavailable fires. Skipping the load
    // would strand the screen on a spinner with nothing to leave it.
    if (id == null) return
    let active = true
    void load(id).then(
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
  }, [id, version, label, load])

  return resolveLoad(id, loaded)
}
