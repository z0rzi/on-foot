import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isPhoneLost } from './adbErrors'

// One adb for every call: the SDK's. The system adb is another version, and two clients of
// different versions restart each other's server, cutting the phone off mid-check.
function resolveAdb(): string {
  const roots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(homedir(), 'android-sdk')]
  const candidates = roots.filter((r): r is string => !!r).map((r) => join(r, 'platform-tools', 'adb'))
  const found = candidates.find((c) => existsSync(c))
  if (!found) throw new Error(`the SDK adb is missing (looked at ${candidates.join(', ')}); set ANDROID_HOME`)
  return found
}

let adbPath: string | null = null
export const adbBinary = () => (adbPath ??= resolveAdb())

export class PhoneGone extends Error {
  constructor() {
    super('phone gone: no device after one reconnect and 4 minutes of waiting in all')
    this.name = 'PhoneGone'
  }
}

export class AdbFailed extends Error {
  constructor(args: string[], readonly stderr: string) {
    super(`adb ${args.join(' ')} failed: ${stderr.trim() || 'no output'}`)
    this.name = 'AdbFailed'
  }
}

export const TIMEOUT = { shell: 8_000, logcat: 15_000, screencap: 20_000, pull: 120_000 }
const RECOVERY_MS = 4 * 60_000
const RECOVERY_POLL_MS = 5_000

interface Raw { ok: boolean; stdout: Buffer; stderr: string; timedOut: boolean }

function runRaw(args: string[], timeoutMs: number): Promise<Raw> {
  return new Promise((resolve) => {
    execFile(adbBinary(), args, { timeout: timeoutMs, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const timedOut = !!error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed === true
      resolve({ ok: !error, stdout, stderr: stderr.toString(), timedOut })
    })
  })
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// For the whole run: one `adb reconnect`, never `kill-server` (another agent may be using the
// server), and 4 minutes of waiting for the device across every drop.
let reconnected = false
let recoveryLeftMs = RECOVERY_MS

async function recover(): Promise<void> {
  process.stderr.write(`phone unreachable: waiting up to ${Math.round(recoveryLeftMs / 1000)} s\n`)
  if (!reconnected) {
    reconnected = true
    await runRaw(['reconnect'], TIMEOUT.shell)
  }
  const started = Date.now()
  try {
    while (Date.now() - started < recoveryLeftMs) {
      const state = await runRaw(['get-state'], TIMEOUT.shell)
      if (state.ok && state.stdout.toString().trim() === 'device') {
        process.stderr.write('phone back\n')
        return
      }
      await sleep(RECOVERY_POLL_MS)
    }
    throw new PhoneGone()
  } finally {
    recoveryLeftMs = Math.max(0, recoveryLeftMs - (Date.now() - started))
  }
}

// Runs one adb command with a timeout. A lost phone is recovered once and the call retried;
// a command that fails on a present phone throws AdbFailed.
export async function adbBuffer(args: string[], timeoutMs = TIMEOUT.shell): Promise<Buffer> {
  let result = await runRaw(args, timeoutMs)
  if (!result.ok && isPhoneLost(result)) {
    await recover()
    result = await runRaw(args, timeoutMs)
    if (!result.ok && isPhoneLost(result)) throw new PhoneGone()
  }
  if (!result.ok) throw new AdbFailed(args, result.stderr)
  return result.stdout
}

export async function adb(args: string[], timeoutMs = TIMEOUT.shell): Promise<string> {
  return (await adbBuffer(args, timeoutMs)).toString()
}

export const shell = (command: string, timeoutMs = TIMEOUT.shell) => adb(['shell', command], timeoutMs)

// A word for the phone's own shell, which `adb shell` hands the command line to.
export const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

let knownSerial: string | null = null

export async function serial(): Promise<string> {
  return (knownSerial ??= (await adb(['get-serialno'])).trim())
}

// The serial read earlier in this run, without reaching for the phone again.
export const lastSerial = () => knownSerial
