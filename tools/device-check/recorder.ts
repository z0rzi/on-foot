import { spawn } from 'node:child_process'
import { closeSync, copyFileSync, existsSync, openSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { sleep } from './adb'
import { evidenceDir, nextShotBase } from './evidence'
import { capturePath, clearRecorderLock, recordedRecorder, recorderErrorsPath, recorderFailurePath, runningRecorder, underStartLock } from './phoneStore'

// The recorder keeps the app's debug log on the host for the whole of a check
// (`recorderProcess.ts`). One per phone, shared by every worktree, started by the first command that
// reaches the phone and stopped by `cleanup`.
const PROCESS = join(__dirname, 'recorderProcess.ts')
const START_TIMEOUT_MS = 20_000
const STOP_TIMEOUT_MS = 5_000
const POLL_MS = 100

// The cause a dead recorder left, taken so that it is reported once.
function takeFailure(serial: string): string | null {
  const path = recorderFailurePath(serial)
  try {
    const cause = readFileSync(path, 'utf8').trim()
    rmSync(path, { force: true })
    return cause || null
  } catch {
    return null
  }
}

function startErrors(serial: string): string {
  try {
    return readFileSync(recorderErrorsPath(serial), 'utf8').trim() || 'no output'
  } catch {
    return 'no output'
  }
}

// The recorder leads a process group of its own, so killing the group takes its adb children too.
function killGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    // The group is already gone.
  }
}

// Detached, under the toolkit's own runtime (tsx's loader is in `execArgv`); done once the recorder
// holds its lock, which it takes after copying in logcat's buffer.
async function start(serial: string): Promise<void> {
  const errors = openSync(recorderErrorsPath(serial), 'w')
  const child = spawn(process.execPath, [...process.execArgv, PROCESS, serial], { detached: true, stdio: ['ignore', 'ignore', errors] })
  closeSync(errors)
  child.unref()
  let ended = ''
  child.on('exit', (code, signal) => (ended = `exited (${signal ?? code})`))
  child.on('error', (error) => (ended = `could not run: ${error.message}`))
  const started = Date.now()
  while (Date.now() - started < START_TIMEOUT_MS) {
    if (child.pid !== undefined && runningRecorder(serial) === child.pid) {
      process.stderr.write(`recorder started in ${((Date.now() - started) / 1000).toFixed(1)} s\n`)
      return
    }
    if (ended !== '') {
      takeFailure(serial)
      throw new Error(`the recorder ${ended} at its start: ${startErrors(serial)}`)
    }
    await sleep(POLL_MS)
  }
  if (child.pid !== undefined) killGroup(child.pid)
  throw new Error(`the recorder did not start in ${START_TIMEOUT_MS / 1000} s: ${startErrors(serial)}`)
}

// A running recorder costs one lock read. A dead one's failure fails this command with its cause,
// once: the next command starts a recorder again.
export async function ensureRecorder(serial: string): Promise<void> {
  if (runningRecorder(serial) !== null) return
  await underStartLock(serial, 'recorder', START_TIMEOUT_MS * 2, async () => {
    if (runningRecorder(serial) !== null) return
    const failure = takeFailure(serial)
    if (failure !== null) throw new Error(`the recorder stopped: ${failure}; the capture holds nothing after that, and the next command starts the recorder again`)
    await start(serial)
  })
}

export interface StoppedRecorder {
  // Where the capture was kept in the evidence folder; null when there was none.
  kept: string | null
  // The cause a recorder that died before `cleanup` left; null when it ran to the end.
  failure: string | null
}

// Stops the recorder, then moves the capture into the evidence folder as the next numbered file,
// so the next check starts a fresh one.
export async function stopRecorder(serial: string): Promise<StoppedRecorder> {
  const pid = runningRecorder(serial)
  if (pid !== null) {
    killGroup(pid)
    const asked = Date.now()
    while (runningRecorder(serial) !== null) {
      if (Date.now() - asked > STOP_TIMEOUT_MS) throw new Error(`the recorder (pid ${pid}) did not stop in ${STOP_TIMEOUT_MS / 1000} s`)
      await sleep(POLL_MS)
    }
  } else {
    const stale = recordedRecorder(serial)
    if (stale !== null) killGroup(stale)
  }
  clearRecorderLock(serial)
  rmSync(recorderErrorsPath(serial), { force: true })
  const failure = takeFailure(serial)
  const capture = capturePath(serial)
  if (!existsSync(capture)) return { kept: null, failure }
  const dir = evidenceDir()
  const kept = join(dir, `${nextShotBase(dir, 'app-log')}.txt`)
  copyFileSync(capture, kept)
  rmSync(capture)
  return { kept, failure }
}
