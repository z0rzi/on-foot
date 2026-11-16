import type { RecordingPhase } from '../recording/recordingPhase'
import type { HookReply, Loading } from './reply'

// What a hook reads of the app besides its cores: the route in front and what still loads.
export interface AppView {
  screen: string | null
  loading: Loading[]
}

type Answer = Exclude<HookReply, { reply: 'not-ready' }>

export const ok = (data: unknown): Answer => ({ reply: 'ok', data })
export const refused = (reason: string): Answer => ({ reply: 'refused', reason })
// A throw is answered with its message: the reply goes to adb, never into the log.
export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
export const refusalOf = (error: unknown): Answer => refused(messageOf(error))

// A rule applied before a hook's core runs: null lets it run, a string is the refusal.
type Guard<A, C> = (args: A, app: AppView, cores: C) => string | null | Promise<string | null>

interface HookDeclaration<A, C> {
  // The request's arguments read into what the hook runs on; a throw is the refusal.
  parse(args: Record<string, unknown>): A
  guards: Guard<A, C>[]
  run(args: A, cores: C, app: AppView): Answer | Promise<Answer>
}

export interface Hook<C> {
  answer(args: Record<string, unknown>, app: AppView, cores: C): Promise<Answer>
}

export function hook<A, C>({ parse, guards, run }: HookDeclaration<A, C>): Hook<C> {
  return {
    answer: async (args, app, cores) => {
      let parsed: A
      try {
        parsed = parse(args)
      } catch (error) {
        return refusalOf(error)
      }
      for (const guard of guards) {
        const reason = await guard(parsed, app, cores)
        if (reason !== null) return refused(reason)
      }
      return run(parsed, cores, app)
    },
  }
}

export const noArguments = (args: Record<string, unknown>): object => {
  if (Object.keys(args).length > 0) throw new Error('this hook takes no arguments')
  return {}
}

const MAP_ROUTE = '/'

// A write never pulls a session or a trail from under another screen.
export const mapInFront: Guard<unknown, unknown> = (_args, { screen }) =>
  screen === MAP_ROUTE ? null : `the map must be in front, not ${screen ?? 'no screen'}`

// While recording, the map shows the recording and the trail it follows: no hook changes that.
export const WHILE_RECORDING = 'refused while recording: a hook never changes what the map shows of a recording'

export const notWhileRecording: Guard<unknown, { recordingPhase(): RecordingPhase }> = (_args, _app, cores) =>
  cores.recordingPhase() === 'idle' ? null : WHILE_RECORDING

const DEVCHECK_PREFIX = 'DEVCHECK '

export const isDevcheckName = (name: string) => name.startsWith(DEVCHECK_PREFIX) && name.length > DEVCHECK_PREFIX.length

// A write touches only what a check made: every name it would write or delete starts with
// `DEVCHECK `. The refusal never quotes the name, which may be the owner's.
export const devcheckOnly =
  <A, C>(names: (args: A, cores: C) => string[] | Promise<string[]>): Guard<A, C> =>
  async (args, _app, cores) =>
    (await names(args, cores)).every(isDevcheckName) ? null : 'an item not named "DEVCHECK …": only DEVCHECK items are written'

// The recording live now, as the recording store mirrors its durable row.
export interface LiveSession {
  id: number
  paused: boolean
}

// The session a `record start` hook started, kept across a relaunch.
export interface AgentSessionRecord {
  read(): Promise<number | null>
  keep(sessionId: number): Promise<void>
  drop(): Promise<void>
}

interface RecordingRead {
  liveSession(): LiveSession | null
  agentSession: Pick<AgentSessionRecord, 'read'>
}

// Whose recording is live: none, the agent session, or one a hook did not start (the owner's).
export async function recordingOwner(cores: RecordingRead): Promise<'none' | 'agent' | 'owner'> {
  const live = cores.liveSession()
  if (!live) return 'none'
  return live.id === (await cores.agentSession.read()) ? 'agent' : 'owner'
}

const OWNER_RECORDING = 'a recording a hook did not start is live: hooks never touch it'

// A write never edits the owner's data in the middle of their recording; an agent session is the
// check's own.
export const noOwnerRecording: Guard<unknown, RecordingRead> = async (_args, _app, cores) =>
  (await recordingOwner(cores)) === 'owner' ? OWNER_RECORDING : null

// A recording hook acts only on the session a hook started.
export const agentSessionOnly: Guard<unknown, RecordingRead> = async (_args, _app, cores) => {
  const owner = await recordingOwner(cores)
  if (owner === 'none') return 'no recording is live'
  return owner === 'owner' ? OWNER_RECORDING : null
}
