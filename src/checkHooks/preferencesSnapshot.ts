const LEFT_OUT = 'lastCamera'
const UNREADABLE = '(not JSON, left out)'

function withoutLastCamera(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutLastCamera)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== LEFT_OUT).map(([key, v]) => [key, withoutLastCamera(v)]))
}

function readEntry(text: string | null): unknown {
  if (text === null) return null
  try {
    return withoutLastCamera(JSON.parse(text))
  } catch {
    return UNREADABLE
  }
}

// The stored preferences as a snapshot carries them, by key: the map's last camera is the one live
// position they hold, so it never leaves the phone.
export function preferencesSnapshot(entries: readonly (readonly [string, string | null])[]): Record<string, unknown> {
  return Object.fromEntries(entries.map(([key, text]) => [key, readEntry(text)]))
}
