// The life of the overview's files (D138). The map engine reads a source's file on its own threads
// and does not see a file overwritten in place, so each version gets a new name, written
// synchronously so the latest always wins. The file a source pointed at before stays until the
// next switch, for a style reload that may still be reading it.

// The overview's sources, each with its own files.
export type OverviewSource = 'lines' | 'pins'

// The directory holding the overview's files, by file name.
export interface OverviewFileStore {
  list(): string[]
  // Writes the file and returns its uri, the source's url; throws when the write fails.
  write(name: string, text: string): string
  remove(name: string): void
}

// `session` tells one mount's files from another's: lowercase letters and digits.
const fileName = (source: OverviewSource, session: string, version: number) =>
  `overview-${source}-${session}-${version}.json`

const isFileOf = (source: OverviewSource, name: string) => new RegExp(`^overview-${source}-[a-z0-9]+-\\d+\\.json$`).test(name)

export function createOverviewFileWriter(source: OverviewSource, session: string, store: OverviewFileStore) {
  let version = 0
  let current: { name: string; text: string } | null = null
  let previous: string | null = null

  const removeAllBut = (keep: (string | null)[]) => {
    for (const name of store.list()) if (isFileOf(source, name) && !keep.includes(name)) store.remove(name)
  }

  return {
    // Every file of the source, whatever mount wrote it, before the first write.
    clearAtMount: () => removeAllBut([]),
    // The new file's uri, or null when the current file already holds the text. A failed write
    // throws and leaves the current file as it was.
    write(text: string): string | null {
      if (current?.text === text) return null
      version += 1
      const name = fileName(source, session, version)
      const uri = store.write(name, text)
      previous = current?.name ?? null
      current = { name, text }
      return uri
    },
    // Once the source points at the current file.
    pruneAfterSwitch: () => removeAllBut([current?.name ?? null, previous]),
  }
}

// One flush per burst, with the latest value, at most `windowMs` after the burst's first change.
export function coalesceBursts<T>(windowMs: number, flush: (latest: T) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latest: T
  return {
    request(value: T) {
      latest = value
      timer ??= setTimeout(() => {
        timer = null
        flush(latest)
      }, windowMs)
    },
    cancel() {
      if (timer != null) clearTimeout(timer)
      timer = null
    },
  }
}
