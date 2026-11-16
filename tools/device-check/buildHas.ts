import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { adb, serial, shell, TIMEOUT } from './adb'
import { buildVerdict, identityOf, launchFromCapture, type IdentityRead } from './buildIdentity'
import { hookData } from './hookData'
import { APP_PACKAGE } from './phoneState'
import { capturePath } from './phoneStore'
import { NoHooks } from './sendHook'
import { holdsCommit, resolveCommit, workingTree } from './workingTree'

// The package's `lastUpdateTime`, `YYYY-MM-DD HH:MM:SS` on the phone's clock; null when it is not installed.
async function installedAt(): Promise<string | null> {
  return /lastUpdateTime=(.*)/.exec(await shell(`dumpsys package ${APP_PACKAGE} | grep lastUpdateTime || true`))?.[1]?.trim() ?? null
}

// Whether the installed APK's JS bundle carries a string the change introduced. Hermes keeps
// strings and function names, not constant names.
export async function buildHas(needle: string): Promise<{ found: boolean; report: string }> {
  const apk = (await shell(`pm path ${APP_PACKAGE}`)).split('\n').map((l) => l.trim().replace(/^package:/, '')).find((l) => l.endsWith('/base.apk'))
  if (!apk) throw new Error(`${APP_PACKAGE} is not installed`)
  const installed = (await installedAt()) ?? 'unknown'
  const dir = mkdtempSync(join(tmpdir(), 'devcheck-apk-'))
  try {
    const local = join(dir, 'base.apk')
    await adb(['pull', apk, local], TIMEOUT.pull)
    const unzip = spawnSync('unzip', ['-p', local, 'assets/index.android.bundle'], { maxBuffer: 512 * 1024 * 1024 })
    if (unzip.error || unzip.status !== 0) throw new Error(`could not read the bundle: ${unzip.error?.message ?? unzip.stderr.toString()}`)
    const found = unzip.stdout.includes(needle)
    return {
      found,
      report: `${found ? 'found' : 'missing'}: "${needle}" in the installed JS bundle (installed ${installed})\n${found ? 'this proves the JS bundle only: a native change needs a build' : 'build needed'}`,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// The installed build's identity: its `state` hook's, or, for a build without hooks, the one its
// last launch logged.
async function installedIdentity(installedAt: string): Promise<IdentityRead> {
  try {
    const { build } = ((await hookData('state')) ?? {}) as Record<string, unknown>
    return { from: 'state', identity: identityOf(build) }
  } catch (error) {
    if (!(error instanceof NoHooks)) throw error
  }
  const path = capturePath(await serial())
  return { from: 'capture', launch: launchFromCapture(existsSync(path) ? readFileSync(path, 'utf8') : ''), installedAt }
}

// Whether the installed build holds a commit.
export async function buildHolds(rev: string): Promise<{ held: boolean; report: string }> {
  const wanted = resolveCommit(rev)
  if (wanted === null) throw new Error(`"${rev}" names no commit in this repository`)
  const installed = await installedAt()
  if (installed === null) throw new Error(`${APP_PACKAGE} is not installed`)
  const read = await installedIdentity(installed)
  const identity = read.from === 'state' ? read.identity : read.launch?.identity
  const holds = identity ? holdsCommit(wanted, identity.commit) : null
  return buildVerdict({ wanted: rev, read, holds, tree: workingTree() })
}
