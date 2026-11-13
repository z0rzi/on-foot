export interface Derived<T> {
  value: T
  failure: { error: unknown } | null
}

// A derivation's value, or the empty value and what it threw: a throw in the overview's derivations
// leaves the overview empty and never reaches the map.
export function derivedOrEmpty<T>(derive: () => T, empty: T): Derived<T> {
  try {
    return { value: derive(), failure: null }
  } catch (error) {
    return { value: empty, failure: { error } }
  }
}
