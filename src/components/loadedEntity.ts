export type LoadOutcome<T> =
  | { status: 'idle' | 'loading' | 'missing' | 'error'; entity: null }
  | { status: 'ready'; entity: T }

export type LoadResult<T> = { ok: true; entity: T | null } | { ok: false }

export type LoadedState<T> = { id: number; result: LoadResult<T> }

// A result is stored under the id it was loaded for, so one keyed to a different id is a stale
// answer to a question nobody is asking any more: it reads as still loading rather than being
// cleared with a setState-in-effect.
export function resolveLoad<T>(id: number | null, loaded: LoadedState<T> | null): LoadOutcome<T> {
  // A bad route param arrives as NaN, which is never equal to itself, so without this it would read
  // as permanently loading.
  if (id == null || !Number.isFinite(id)) return { status: 'idle', entity: null }
  if (loaded == null || loaded.id !== id) return { status: 'loading', entity: null }
  if (!loaded.result.ok) return { status: 'error', entity: null }
  if (loaded.result.entity == null) return { status: 'missing', entity: null }
  return { status: 'ready', entity: loaded.result.entity }
}
