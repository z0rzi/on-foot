import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sleep } from './adb'

// What the toolkit keeps per phone, not per worktree: the walk's mark, the lock of the walk that
// moves, the recorder's lock and capture, and the locks of a reader or recorder start. Every agent
// on this machine sees the same walker, reader and recorder, so one agent's clean-up cannot stop
// another's walk unknowingly, and each process is started once.
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
const recorderLockPath = (serial: string) => join(DIR, `${serial}.recorder.lock`)
export const capturePath = (serial: string) => join(DIR, `${serial}.app-log.txt`)
export const recorderErrorsPath = (serial: string) => join(DIR, `${serial}.recorder-errors.txt`)
// The cause a recorder that could not go on leaves for the next command.
export const recorderFailurePath = (serial: string) => join(DIR, `${serial}.recorder-failure.txt`)

export type PerPhoneProcess = 'reader' | 'recorder'

const startLockPath = (serial: string, process: PerPhoneProcess) => join(DIR, `${serial}.${process}-start.lock`)
const START_POLL_MS = 200

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

// The PID a lock file names, whether or not that process still runs.
function lockPid(path: string): number | null {
  try {
    const pid = Number(readFileSync(path, 'utf8'))
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

// The PID holding a lock file, if that process still runs.
function lockHolder(path: string): number | null {
  const pid = lockPid(path)
  return pid !== null && alive(pid) ? pid : null
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

// Runs `start` once no other toolkit run is starting the same process for this phone, so one starts
// it and the others, once they have waited, find it running.
export async function underStartLock<T>(serial: string, which: PerPhoneProcess, waitMs: number, start: () => Promise<T>): Promise<T> {
  const path = startLockPath(serial, which)
  const waitedFrom = Date.now()
  let holder = tryLock(path)
  while (holder !== null) {
    if (Date.now() - waitedFrom > waitMs) throw new Error(`another toolkit run (pid ${holder}) has been starting the ${which} for too long`)
    await sleep(START_POLL_MS)
    holder = tryLock(path)
  }
  try {
    return await start()
  } finally {
    releaseLock(path)
  }
}

// The PID of the recorder of this phone, if it still runs.
export const runningRecorder = (serial: string) => lockHolder(recorderLockPath(serial))

// Taken by the recorder itself: null once taken, else the PID of the live recorder holding it.
export const takeRecorderLock = (serial: string) => tryLock(recorderLockPath(serial))

// The recorder's PID as its lock names it, a dead one's too, whose adb children may outlive it.
export const recordedRecorder = (serial: string) => lockPid(recorderLockPath(serial))

export const clearRecorderLock = (serial: string) => rmSync(recorderLockPath(serial), { force: true })

export function clearWalk(serial: string): void {
  rmSync(moveLockPath(serial), { force: true })
  updateMemory(serial, { walk: null })
}
