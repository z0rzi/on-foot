import { useEffect, useState } from 'react'
import { Directory, File, Paths } from 'expo-file-system'
import { coalesceBursts, createOverviewFileWriter, type OverviewFileStore, type OverviewSource } from './overviewFiles'
import { errorClass, logEvent } from '../../../log'

// In the document directory, which Android never clears while the app runs, unlike the cache.
const directory = () => new Directory(Paths.document, 'overview')

const documentStore: OverviewFileStore = {
  list: () => {
    const dir = directory()
    return dir.exists ? dir.list().flatMap((entry) => (entry instanceof File ? [entry.name] : [])) : []
  },
  write: (name, text) => {
    const dir = directory()
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
    const file = new File(dir, name)
    file.write(text)
    return file.uri
  },
  remove: (name) => new File(directory(), name).delete(),
}

// How long a burst of store changes is gathered before one write: a trail deletion reloads the
// activities, then the trails.
const WRITE_WINDOW_MS = 100

// What one source's file is made of, and what is logged once it is written.
export interface OverviewFileKind<T> {
  source: OverviewSource
  build: (data: T) => string
  onWritten: (data: T, ms: number) => void
}

// The uri of the file holding the latest data, once one is written; null until then. `kind` is read
// once, at mount.
export function useOverviewFile<T>(kind: OverviewFileKind<T>, data: T): string | null {
  const [uri, setUri] = useState<string | null>(null)
  const [writer] = useState(() => createOverviewFileWriter(kind.source, Date.now().toString(36), documentStore))
  const [burst] = useState(() =>
    coalesceBursts<T>(WRITE_WINDOW_MS, (latest) => {
      try {
        const started = performance.now()
        const written = writer.write(kind.build(latest))
        if (written == null) return
        kind.onWritten(latest, performance.now() - started)
        setUri(written)
      } catch (error) {
        logEvent('warn', 'map', 'overview file write failed', { source: kind.source, errorClass: errorClass(error) })
      }
    }),
  )

  useEffect(() => {
    try {
      writer.clearAtMount()
    } catch (error) {
      logEvent('warn', 'map', 'overview files not cleared', { source: kind.source, errorClass: errorClass(error) })
    }
    return () => burst.cancel()
  }, [writer, burst, kind.source])

  useEffect(() => burst.request(data), [burst, data])

  useEffect(() => {
    if (uri == null) return
    try {
      writer.pruneAfterSwitch()
    } catch (error) {
      logEvent('warn', 'map', 'overview files not cleared', { source: kind.source, errorClass: errorClass(error) })
    }
  }, [writer, uri, kind.source])

  return uri
}
