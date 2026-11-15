// The reader is the Appium UiAutomator2 server, two apps on the phone: the server and the test
// runner that starts it as an instrumentation. Its state is read from what it and the phone answer.
export const READER_PACKAGE = 'io.appium.uiautomator2.server'
export const READER_TEST_PACKAGE = `${READER_PACKAGE}.test`
export const PINNED_READER_VERSION = '10.6.6'

export type ReaderState =
  | { kind: 'running' }
  | { kind: 'not-answering' }
  | { kind: 'other-version'; version: string }
  | { kind: 'suppressing' }

function parse(body: string | null): unknown {
  try {
    return body ? JSON.parse(body) : null
  } catch {
    return null
  }
}

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined

const servicesIn = (dumpsysAccessibility: string, list: string) =>
  new RegExp(`^\\s*${list} services:\\{(.*)\\}\\s*$`, 'm').exec(dumpsysAccessibility)?.[1] ?? ''

// A server started without DISABLE_SUPPRESS_ACCESSIBILITY_SERVICES unbinds every accessibility
// service for as long as it runs: the owner's are enabled and none is bound, binding or crashed.
function suppressing(dumpsysAccessibility: string): boolean {
  if (servicesIn(dumpsysAccessibility, 'Enabled') === '') return false
  return ['Bound', 'Binding', 'Crashed'].every((list) => servicesIn(dumpsysAccessibility, list) === '')
}

// From the body of `GET /status` (null: nothing answered) and `dumpsys accessibility` (null: not
// looked at).
export function readerState(status: string | null, dumpsysAccessibility: string | null): ReaderState {
  const value = field(parse(status), 'value')
  if (field(value, 'ready') !== true) return { kind: 'not-answering' }
  const version = field(field(value, 'build'), 'version')
  if (version !== PINNED_READER_VERSION) return { kind: 'other-version', version: String(version) }
  if (dumpsysAccessibility !== null && suppressing(dumpsysAccessibility)) return { kind: 'suppressing' }
  return { kind: 'running' }
}

// From OxygenOS's battery manager lines in logcat (tag `OplusHansManager`): whether it froze this process
// of the reader, which it does to an app not allowed background activity, 10 s after its last
// activity. A frozen server answers nothing until something wakes it.
export function frozenByBatteryManager(hansLog: string, pid: number): boolean {
  const freezes = hansLog.matchAll(new RegExp(`\\bfreeze uid: \\d+ ${READER_PACKAGE.replace(/\./g, '\\.')} pids: \\[([\\d, ]+)\\]`, 'g'))
  return [...freezes].some((m) => m[1].split(',').map((p) => Number(p.trim())).includes(pid))
}

export type InstalledReader = { kind: 'installed' } | { kind: 'missing'; packages: string[] } | { kind: 'other-version'; version: string }

// From `pm list packages io.appium.uiautomator2` and `dumpsys package` of the server. The test
// runner carries no version of its own.
export function installedReader(packageList: string, serverDumpsys: string): InstalledReader {
  const listed = new Set(packageList.split('\n').map((line) => line.trim().replace(/^package:/, '')))
  const missing = [READER_PACKAGE, READER_TEST_PACKAGE].filter((p) => !listed.has(p))
  if (missing.length > 0) return { kind: 'missing', packages: missing }
  const version = /versionName=(\S+)/.exec(serverDumpsys)?.[1] ?? 'unknown'
  return version === PINNED_READER_VERSION ? { kind: 'installed' } : { kind: 'other-version', version }
}

// From the body of `GET /sessions`: the one session the server holds, if any.
export function readerSession(sessions: string): string | null {
  const list = field(parse(sessions), 'value')
  const id = Array.isArray(list) ? field(list[0], 'id') : undefined
  return typeof id === 'string' ? id : null
}

// From the body of `POST /session`: the session just opened, null when none was.
export function createdSession(body: string): string | null {
  const id = field(field(parse(body), 'value'), 'sessionId')
  return typeof id === 'string' ? id : null
}

// The error the server answered with, as `<error>: <message>`, or null for an answer without one.
export function answerError(body: string): string | null {
  const value = field(parse(body), 'value')
  const error = field(value, 'error')
  return typeof error === 'string' ? `${error}: ${String(field(value, 'message') ?? '')}` : null
}

export type PageSource = { kind: 'tree'; xml: string } | { kind: 'no-session' } | { kind: 'error'; message: string }

// From the body of `GET /session/<id>/source`. A session is lost when another one replaced it.
export function pageSource(body: string): PageSource {
  const value = field(parse(body), 'value')
  if (typeof value === 'string' && value.length > 0) return { kind: 'tree', xml: value }
  if (field(value, 'error') === 'invalid session id') return { kind: 'no-session' }
  return { kind: 'error', message: answerError(body) ?? 'no tree in the answer' }
}
