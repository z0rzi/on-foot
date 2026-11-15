import { spawn } from 'node:child_process'
import { openSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { adbBinary, sleep } from './adb'
import { appLogEntries } from './appLog'
import { alreadyWritten, captureLine, endsOnGap, gapMarker, recorderLogcat, resumePoint } from './capture'
import { errorMessage } from './errorMessage'
import { capturePath, recorderFailurePath, takeRecorderLock } from './phoneStore'

// The recorder: a host process started detached by `recorder.ts`, one per phone, that appends the
// app's debug-log mirror from logcat to the capture until `cleanup` kills its process group. It
// takes its lock once the capture holds what logcat's buffer had, so its starter returns on a
// capture that is up to date.

const RETRY_MS = 1_000

const [serial] = process.argv.slice(2)
const path = capturePath(serial)

// A recorder that cannot go on (the capture unwritable, a crash) leaves its cause for the next
// command, which reports it rather than starting a recorder that fails the same way unseen.
function fail(error: unknown): never {
  const cause = errorMessage(error)
  process.stderr.write(`${cause}\n`)
  try {
    writeFileSync(recorderFailurePath(serial), `${cause}\n`)
  } catch (written) {
    process.stderr.write(`the cause could not be kept: ${errorMessage(written)}\n`)
  }
  process.exit(1)
}

process.on('uncaughtException', fail)

let fd = -1
const append = (line: string) => writeSync(fd, `${line}\n`)

function markGap(lostAt: Date, backAt: Date): void {
  if (!endsOnGap(readFileSync(path, 'utf8'))) append(gapMarker(lostAt, backAt))
}

// Runs adb against this phone until it exits, each line it prints handed to `onLine`; adb's errors
// go to the recorder's own stderr.
function runAdb(args: string[], onLine: (line: string) => void = () => {}): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(adbBinary(), ['-s', serial, ...args], { stdio: ['ignore', 'pipe', 'inherit'] })
    createInterface({ input: child.stdout }).on('line', onLine)
    child.on('close', () => resolve())
    child.on('error', (error) => {
      process.stderr.write(`adb ${args.join(' ')}: ${error.message}\n`)
      resolve()
    })
  })
}

// How far back a fresh capture reaches into logcat: a launch shortly before the check's first
// command is in it, and the read stays bounded whatever logcat's buffer size.
const WINDOW_S = 600

// The start of the window in logcat's time format, by the phone's clock.
async function windowStart(): Promise<string> {
  let start = ''
  await runAdb(['shell', `date -d @$(( $(date +%s) - ${WINDOW_S} )) '+%m-%d %H:%M:%S.000'`], (line) => (start = line.trim()))
  if (start === '') throw new Error("could not read the phone's clock for the capture's window")
  return start
}

// One run of logcat, the lines replayed up to the capture's last entry dropped. `dump` stops at
// the buffer's end instead of following.
async function logcat(dump: boolean): Promise<void> {
  const capture = readFileSync(path, 'utf8')
  const point = resumePoint(capture)
  let replaying = point !== null
  await runAdb(recorderLogcat(capture, point ? '' : await windowStart(), dump), (raw) => {
    for (const entry of appLogEntries(raw)) {
      if (replaying && point && alreadyWritten(point, entry)) continue
      replaying = false
      append(captureLine(entry))
    }
  })
}

// Logcat ends when the phone drops off or the adb server restarts; the recorder then waits for the
// phone, for as long as it takes, marks the gap and follows again. A capture left by a dead
// recorder is continued, its last write dating the start of the gap.
async function record(): Promise<void> {
  fd = openSync(path, 'a')
  const opened = statSync(path)
  if (opened.size > 0) markGap(opened.mtime, new Date())
  await logcat(true)
  if (takeRecorderLock(serial) !== null) return
  for (;;) {
    await logcat(false)
    const lostAt = new Date()
    await sleep(RETRY_MS)
    await runAdb(['wait-for-device'])
    markGap(lostAt, new Date())
  }
}

record().catch(fail)
