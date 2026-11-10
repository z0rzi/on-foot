import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Bounds } from './uiDump'

// Per phone, not per worktree: every agent on this machine sees the same walker, so one agent's
// clean-up cannot stop another's walk unknowingly.
const DIR = join(process.env.XDG_RUNTIME_DIR ?? tmpdir(), 'on-foot-device-check')

export interface WalkState {
  route: string
  mark: number
  offset: number
}

export interface PhoneMemory {
  walk: WalkState | null
  recordButton: Bounds | null
}

const EMPTY: PhoneMemory = { walk: null, recordButton: null }

const statePath = (serial: string) => join(DIR, `${serial}.json`)
const lockPath = (serial: string) => join(DIR, `${serial}.lock`)

export function readMemory(serial: string): PhoneMemory {
  try {
    return { ...EMPTY, ...(JSON.parse(readFileSync(statePath(serial), 'utf8')) as Partial<PhoneMemory>) }
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

// The PID of the move holding the phone, if that process still runs.
export function runningMove(serial: string): number | null {
  try {
    const pid = Number(readFileSync(lockPath(serial), 'utf8'))
    return Number.isInteger(pid) && pid > 0 && alive(pid) ? pid : null
  } catch {
    return null
  }
}

export function acquireMove(serial: string): void {
  mkdirSync(DIR, { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath(serial), String(process.pid), { flag: 'wx' })
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const holder = runningMove(serial)
      if (holder !== null) throw new Error(`a walk holds the phone (pid ${holder}): wait for it, or \`walk stop\` if its holder is gone`)
      rmSync(lockPath(serial), { force: true })
    }
  }
  throw new Error('could not take the walk lock')
}

export function releaseMove(serial: string): void {
  if (runningMove(serial) === process.pid) rmSync(lockPath(serial), { force: true })
}

export function clearWalk(serial: string): void {
  rmSync(lockPath(serial), { force: true })
  updateMemory(serial, { walk: null })
}
