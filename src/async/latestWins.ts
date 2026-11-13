// Each call supersedes the ones before it: a result is applied only if no later call has started
// since, so an earlier call landing late never overwrites a later one. A rejection reaches its own
// caller and applies nothing.
export function createLatestWins() {
  let latest = 0
  return async <T>(operation: () => Promise<T>, apply: (result: T) => void): Promise<void> => {
    const call = ++latest
    const result = await operation()
    if (call === latest) apply(result)
  }
}
