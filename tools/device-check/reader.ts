import { execFileSync } from 'node:child_process'
import { adb, AdbFailed, shell, sleep, TIMEOUT } from './adb'
import {
  answerError,
  frozenByBatteryManager,
  installedReader,
  pageSource,
  PINNED_READER_VERSION,
  READER_PACKAGE,
  READER_TEST_PACKAGE,
  readerSession,
  readerState,
  createdSession,
} from './readerState'
import { underStartLock } from './phoneStore'

// The reader answers HTTP on the phone's port, reached through an adb forward of the same port on
// the host. One server per phone, shared by every worktree.
const PORT = 6790
const BASE = `http://127.0.0.1:${PORT}`
const INSTRUMENTATION = `${READER_TEST_PACKAGE}/androidx.test.runner.AndroidJUnitRunner`
// Without DISABLE_SUPPRESS_ACCESSIBILITY_SERVICES the server unbinds the owner's accessibility
// services for as long as it runs.
const START_ARGS = '-e disableAnalytics true -e DISABLE_SUPPRESS_ACCESSIBILITY_SERVICES true'
const START_LOG = '/data/local/tmp/devcheck-reader.log'
const SETUP = 'see SKILL.md, Phone setup'

const STATUS_TIMEOUT_MS = 2_000
const SOURCE_TIMEOUT_MS = 10_000
const START_TIMEOUT_MS = 20_000
const START_POLL_MS = 200

// The body of the answer, or null when nothing answered: no listener behind the forward, no forward,
// or no answer in time.
async function request(method: 'GET' | 'POST', path: string, timeoutMs: number, body?: object): Promise<string | null> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    return await response.text()
  } catch {
    return null
  }
}

// A silent reader may be a lost phone: one adb call takes adb's path, a reconnect then `phone gone`.
const confirmPhone = () => shell('true')

function portHolder(): string {
  try {
    return execFileSync('ss', ['-Hltnp', `sport = :${PORT}`], { encoding: 'utf8' }).trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

async function ensureForward(serial: string): Promise<void> {
  if ((await adb(['forward', '--list'])).includes(`${serial} tcp:${PORT} tcp:${PORT}`)) return
  try {
    await adb(['forward', `tcp:${PORT}`, `tcp:${PORT}`])
  } catch (error) {
    if (error instanceof AdbFailed) throw new Error(`the reader's port ${PORT} cannot be forwarded on this machine (holder: ${portHolder()}): ${error.stderr.trim()}`)
    throw error
  }
}

async function requireInstalled(): Promise<void> {
  const installed = installedReader(
    await shell(`pm list packages ${READER_PACKAGE}`),
    await shell(`dumpsys package ${READER_PACKAGE} | grep versionName || true`),
  )
  if (installed.kind === 'missing') throw new Error(`the reader is not installed (${installed.packages.join(', ')} missing; ${SETUP})`)
  if (installed.kind === 'other-version') throw new Error(`the reader is ${installed.version}, not the pinned ${PINNED_READER_VERSION} (${SETUP})`)
}

export async function stopReader(): Promise<void> {
  await shell(`am force-stop ${READER_PACKAGE}; am force-stop ${READER_TEST_PACKAGE}`)
}

async function start(why: string): Promise<void> {
  await requireInstalled()
  await stopReader()
  const started = Date.now()
  await shell(`nohup am instrument -w ${START_ARGS} ${INSTRUMENTATION} > ${START_LOG} 2>&1 &`)
  while (Date.now() - started < START_TIMEOUT_MS) {
    await sleep(START_POLL_MS)
    if (readerState(await request('GET', '/status', STATUS_TIMEOUT_MS), null).kind === 'running') {
      process.stderr.write(`reader ${why}: started in ${((Date.now() - started) / 1000).toFixed(1)} s\n`)
      return
    }
  }
  const log = (await shell(`cat ${START_LOG} 2>&1 || true`)).trim()
  throw new Error(`the reader did not start in ${START_TIMEOUT_MS / 1000} s; instrumentation output: ${log || 'none'}`)
}

// The phone's accessibility services are looked at once per run: a server started without the
// argument, by hand or by another tool, is replaced.
let servicesChecked = false

async function state(serial: string) {
  let status = await request('GET', '/status', STATUS_TIMEOUT_MS)
  if (status === null) {
    await confirmPhone()
    await ensureForward(serial)
    await refuseFrozen()
    status = await request('GET', '/status', STATUS_TIMEOUT_MS)
  }
  const looked = status !== null && !servicesChecked
  const current = readerState(status, looked ? await shell('dumpsys accessibility') : null)
  if (looked && current.kind === 'running') servicesChecked = true
  return current
}

// A server that is up and silent may be frozen by OxygenOS's battery manager, which stalls every
// read after a pause. It is stopped, so the next run starts one the exemption covers.
async function refuseFrozen(): Promise<void> {
  const pid = Number((await shell(`pidof ${READER_PACKAGE} || true`)).trim())
  if (!Number.isInteger(pid) || pid <= 0) return
  if (frozenByBatteryManager(await shell(`logcat -d -b main | grep -F '${READER_PACKAGE} pids:' || true`, TIMEOUT.logcat), pid)) {
    await stopReader()
    throw new Error(`the reader was frozen by the phone's battery manager and is stopped: allow its background activity (${SETUP})`)
  }
}

const otherVersionRunning = (version: string) => new Error(`the reader running is ${version}, not the pinned ${PINNED_READER_VERSION} (${SETUP})`)

async function ensureRunning(serial: string): Promise<void> {
  const first = await state(serial)
  if (first.kind === 'running') return
  if (first.kind === 'other-version') throw otherVersionRunning(first.version)
  await underStartLock(serial, 'reader', START_TIMEOUT_MS * 2, async () => {
    const now = await state(serial)
    if (now.kind === 'running') return
    if (now.kind === 'other-version') throw otherVersionRunning(now.version)
    await start(now.kind === 'suppressing' ? 'was suppressing accessibility services' : 'was not answering')
    servicesChecked = true
  })
}

let session: string | null = null

// The server answered the read with an error instead of a tree, as it may while the screen changes.
export class ReaderAnsweredError extends Error {
  constructor(message: string) {
    super(`the reader failed: ${message}`)
    this.name = 'ReaderAnsweredError'
  }
}

// The server holds one session; a new one replaces it and resets its settings, so the one held is
// reused. The idle wait is zero: a read never waits for the screen to idle.
async function openSession(): Promise<string> {
  const held = readerSession((await request('GET', '/sessions', STATUS_TIMEOUT_MS)) ?? '')
  const id = held ?? createdSession((await request('POST', '/session', STATUS_TIMEOUT_MS, { capabilities: {} })) ?? '')
  if (id === null) throw new Error('the reader opened no session')
  const set = await request('POST', `/session/${id}/appium/settings`, STATUS_TIMEOUT_MS, { settings: { waitForIdleTimeout: 0 } })
  const refused = set === null ? 'no answer' : answerError(set)
  if (refused !== null) throw new Error(`the reader refused a zero idle wait: ${refused}`)
  return id
}

// The screen's accessibility tree as XML, read through the reader, started first if it does not
// answer. A reader that dies or loses its session during the read is taken up again once.
export async function readTree(serial: string): Promise<string> {
  let lost = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    await ensureRunning(serial)
    session ??= await openSession()
    const body = await request('GET', `/session/${session}/source`, SOURCE_TIMEOUT_MS)
    const source = body === null ? null : pageSource(body)
    if (source?.kind === 'tree') return source.xml
    if (source?.kind === 'error') throw new ReaderAnsweredError(source.message)
    if (source === null) await confirmPhone()
    lost = source === null ? `gave no answer in ${SOURCE_TIMEOUT_MS / 1000} s` : 'lost its session'
    session = null
  }
  throw new Error(`the reader ${lost} twice in a row`)
}
