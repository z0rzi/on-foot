import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { adb, shell, TIMEOUT } from './adb'
import { APP_PACKAGE } from './phoneState'

// Whether the installed APK's JS bundle carries a string the change introduced. Hermes keeps
// strings and function names, not constant names.
export async function buildHas(needle: string): Promise<{ found: boolean; report: string }> {
  const apk = (await shell(`pm path ${APP_PACKAGE}`)).split('\n').map((l) => l.trim().replace(/^package:/, '')).find((l) => l.endsWith('/base.apk'))
  if (!apk) throw new Error(`${APP_PACKAGE} is not installed`)
  const installed = /lastUpdateTime=(.*)/.exec(await shell(`dumpsys package ${APP_PACKAGE} | grep lastUpdateTime || true`))?.[1]?.trim() ?? 'unknown'
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
