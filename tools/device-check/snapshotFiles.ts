import { nextShotNumber, shotBase } from './evidence'

export interface SnapshotFiles {
  database: string
  preferences: string
}

// The snapshot hook's data: where the app wrote the database's copy and the preferences.
export function snapshotFiles(data: unknown): SnapshotFiles {
  const { database, preferences } = (data ?? {}) as Record<string, unknown>
  if (typeof database !== 'string' || typeof preferences !== 'string') {
    throw new Error('the snapshot hook answered without the paths of its two files')
  }
  return { database, preferences }
}

const NAME = 'snapshot'
const EXTENSIONS = { database: '.db', preferences: '.preferences.json' }
const PULLED = /^\d{2,}-snapshot(?:\.db|\.preferences\.json)$/

// The names a snapshot's files take in the evidence folder, numbered as the next evidence.
export function pulledNames(evidence: string[]): SnapshotFiles {
  const base = shotBase(nextShotNumber(evidence), NAME)
  return { database: `${base}${EXTENSIONS.database}`, preferences: `${base}${EXTENSIONS.preferences}` }
}

export const isSnapshotFile = (name: string) => PULLED.test(name)
