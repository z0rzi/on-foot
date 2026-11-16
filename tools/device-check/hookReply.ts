import { quote } from './adb'
import { describeIdentity, identityOf } from './buildIdentity'
import { APP_PACKAGE } from './phoneState'

// The app's check-hook receiver (modules/check-hooks), registered only by a build with the flag.
const HOOK_ACTION = `${APP_PACKAGE}.CHECK_HOOK`

// The receiver's result codes besides a reply, which comes with data; a broadcast no receiver took
// keeps `am broadcast`'s initial 0.
const RESULT = { none: 0, noReply: 2 }

export type HookReply =
  | { reply: 'ok'; data: unknown }
  | { reply: 'refused'; reason: string }
  | { reply: 'not-ready'; loading: string[] }

export type Broadcast = { kind: 'reply'; reply: HookReply } | { kind: 'no-dispatcher' } | { kind: 'no-reply' }

// The phone's shell line for one hook: an ordered broadcast to On Foot alone, which `am broadcast`
// waits on, sent as a foreground one for its shorter time limit.
export const broadcastCommand = (hook: string, args: Record<string, unknown>) =>
  `am broadcast -a ${HOOK_ACTION} -p ${APP_PACKAGE} --receiver-foreground --es hook ${quote(hook)} --es args ${quote(JSON.stringify(args))}`

function replyOf(json: string): HookReply | null {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const { reply, data, reason, loading } = value as Record<string, unknown>
  if (reply === 'ok') return { reply, data }
  if (reply === 'refused' && typeof reason === 'string') return { reply, reason }
  if (reply === 'not-ready' && Array.isArray(loading) && loading.every((l) => typeof l === 'string')) return { reply, loading }
  return null
}

// `Broadcast completed: result=N[, data="…"]`, the data printed as the app set it, unescaped. The
// app's reply writer (src/checkHooks/reply.ts) is held to this reader by the cross-check test.
export function parseBroadcast(output: string): Broadcast {
  const m = /Broadcast completed: result=(-?\d+)(?:, data="([\s\S]*)")?\s*$/.exec(output)
  if (!m) throw new Error(`\`am broadcast\` printed no result: ${output.trim()}`)
  const code = Number(m[1])
  const data = m[2]
  if (data !== undefined) {
    const reply = replyOf(data)
    if (!reply) throw new Error(`an unreadable reply: ${data}`)
    return { kind: 'reply', reply }
  }
  if (code === RESULT.none) return { kind: 'no-dispatcher' }
  if (code === RESULT.noReply) return { kind: 'no-reply' }
  throw new Error(`\`am broadcast\` printed an unknown result: ${output.trim()}`)
}

const word = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value))

function selectionOf(value: unknown): string {
  if (value === null) return 'none'
  const { kind, id } = (value ?? {}) as Record<string, unknown>
  return `${word(kind)} ${word(id)}`
}

function recordingOf({ recording, agentSession }: Record<string, unknown>): string {
  if (recording === 'idle') return 'idle'
  return `${word(recording)}, ${agentSession === true ? 'agent session' : 'not an agent session'}`
}

// The state hook's data, one reading a line.
export function stateReport(data: unknown): string {
  const read = (data ?? {}) as Record<string, unknown>
  const identity = identityOf(read.build)
  return [
    `screen: ${word(read.screen)}`,
    `selection: ${selectionOf(read.selection)}`,
    `map mode: ${word(read.mapMode)}`,
    `follow mode: ${word(read.followMode)}`,
    `recording: ${recordingOf(read)}`,
    `build: ${identity ? describeIdentity(identity) : 'no identity (not made by `devcheck build`)'}`,
  ].join('\n')
}

const itemLine = (value: unknown) => {
  const { kind, id, name } = (value ?? {}) as Record<string, unknown>
  return `${word(kind)} ${word(id)} "${word(name)}"`
}

// The import-gpx hook's data: the new trail.
export const importReport = (data: unknown) => `imported ${itemLine({ kind: 'trail', ...(data as object) })}`

// The delete hook's data: the item it deleted.
export const deleteReport = (data: unknown) => `deleted ${itemLine(data)}`

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

// The cleanup hook's data: what it deleted, then what it could not and why; complete when nothing is left.
export function cleanupReport(data: unknown): { report: string; complete: boolean } {
  const read = (data ?? {}) as Record<string, unknown>
  const deleted = listOf(read.deleted).map(itemLine)
  const failed = listOf(read.failed).map((item) => `  ${itemLine(item)}: ${word((item as Record<string, unknown>).reason)}`)
  const lines = [`deleted ${deleted.length}${deleted.length > 0 ? `: ${deleted.join(', ')}` : ''}`, ...(failed.length > 0 ? ['could not delete:', ...failed] : [])]
  return { report: lines.join('\n'), complete: failed.length === 0 }
}

const RECORD_DONE: Record<string, string> = {
  'record-start': 'started',
  'record-pause': 'paused',
  'record-resume': 'resumed',
  'record-discard': 'discarded',
  'record-save': 'saved',
}

// A recording hook's data: the agent session it acted on, and the activity a save made.
export function recordReport(hook: string, data: unknown): string {
  const { sessionId, activityId } = (data ?? {}) as Record<string, unknown>
  const done = `agent session ${word(sessionId)} ${RECORD_DONE[hook] ?? hook}`
  return activityId === undefined ? done : `${done} as activity ${word(activityId)}`
}

const PLURAL = { trail: 'trails', activity: 'activities' } as const

// The list hook's data: each DEVCHECK item by id and name, then how many others there are.
export function listReport(kind: 'trail' | 'activity', data: unknown): string {
  const { devcheck, others } = (data ?? {}) as Record<string, unknown>
  const items = Array.isArray(devcheck) ? (devcheck as Record<string, unknown>[]) : []
  const lines = items.length > 0 ? items.map(({ id, name }) => `${word(id)}  ${word(name)}`) : [`no DEVCHECK ${PLURAL[kind]}`]
  return [...lines, `and ${word(others)} ${others === 1 ? kind : PLURAL[kind]} not named DEVCHECK`].join('\n')
}
