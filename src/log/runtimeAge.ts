// Bootstrap loads the log first, so this is the start of the JS runtime, give or take the log's own load.
const loadedAt = Date.now()

export function runtimeAgeMs(): number {
  return Date.now() - loadedAt
}
