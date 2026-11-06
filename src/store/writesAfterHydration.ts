import type { PersistStorage } from 'zustand/middleware'

// A persist storage that drops writes until the store has hydrated. zustand persist writes on every
// set, so without it the defaults a store runs on while its read is pending, has failed or was given
// up on would overwrite what storage holds.
export function writesAfterHydration<S>(
  storage: PersistStorage<S> | undefined,
  hasHydrated: () => boolean,
): PersistStorage<S> | undefined {
  if (!storage) return undefined
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => (hasHydrated() ? storage.setItem(name, value) : undefined),
    removeItem: (name) => storage.removeItem(name),
  }
}
