import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// What the toolkit keeps per phone, not per worktree: the walk's mark, the lock of the walk that
// moves, and the lock of a reader start. Every agent on this machine sees the same walker and the
// same reader, so one agent's clean-up cannot stop another's walk unknowingly, and the reader is
// started once.
const DIR = join(process.env.XDG_RUNTIME_DIR ?? tmpdir(), 'on-foot-device-check')

export interface WalkState {
  route: string
  mark: number
  offset: number
}

export interface PhoneMemory {
  walk: WalkState | null
}

const EMPTY: PhoneMemory = { walk: null }

const statePath = (serial: string) => join(DIR, `${serial}.json`)
const moveLockPath = (serial: string) => join(DIR, `${serial}.lock`)
const readerStartLockPath = (serial: string) => join(DIR, `${serial}.reader-start.lock`)

export function readMemory(serial: string): PhoneMemory {
  try {
    const saved = JSON.parse(readFileSync(statePath(serial), 'utf8')) as Partial<PhoneMemory>
    return { walk: saved.walk ?? null }
  } catch {
    return EMPTY
  }
}

export function updateMemory(serial: string, change: Partial<PhoneMemory>): void {
  mkdirSync(DIR, { recursive: true })
  const next = { ...readMemory(serial), ...change }
  const tmp = `${statePath(serial)}.${process.pid}`
  writeFileSync(tmp, JSON.stringify(next))
  renameSync(tmp, statePath(serial))
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// The PID holding a lock file, if that process still runs.
function lockHolder(path: string): number | null {
  try {
    const pid = Number(readFileSync(path, 'utf8'))
    return Number.isInteger(pid) && pid > 0 && alive(pid) ? pid : null
  } catch {
    return null
  }
}

// Takes the lock for this process: null once taken, else the PID of the live process holding it.
// A lock left by a dead process is taken over.
function tryLock(path: string): number | null {
  mkdirSync(DIR, { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(path, String(process.pid), { flag: 'wx' })
      return null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const holder = lockHolder(path)
      if (holder !== null) return holder
      rmSync(path, { force: true })
    }
  }
  throw new Error(`could not take the lock ${path}`)
}

function releaseLock(path: string): void {
  if (lockHolder(path) === process.pid) rmSync(path, { force: true })
}

// The PID of the move holding the phone, if that process still runs.
export const runningMove = (serial: string) => lockHolder(moveLockPath(serial))

export function acquireMove(serial: string): void {
  const holder = tryLock(moveLockPath(serial))
  if (holder !== null) throw new Error(`a walk holds the phone (pid ${holder}): wait for it, or \`walk stop\` if its holder is gone`)
}

export const releaseMove = (serial: string) => releaseLock(moveLockPath(serial))

// One process starts the reader at a time; the others wait and then find it running.
export const tryReaderStart = (serial: string) => tryLock(readerStartLockPath(serial))
export const releaseReaderStart = (serial: string) => releaseLock(readerStartLockPath(serial))

export function clearWalk(serial: string): void {
  rmSync(moveLockPath(serial), { force: true })
  updateMemory(serial, { walk: null })
}
