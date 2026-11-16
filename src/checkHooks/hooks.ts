import { EFFORTS } from '../activities/effort'
import type { ShowActivityOutcome } from '../activities/showActivity'
import type { Difficulty } from '../data/trails/types'
import type { ActivityFormFields } from '../data/activities/mapping'
import type { Effort } from '../data/activities/types'
import type { FollowMode } from '../map/followCamera'
import type { MapMode } from '../map/mapMode'
import type { LoadedRecording } from '../recording/mapRecording'
import type { CaptureCheck } from '../recording/recordingController'
import type { RecordingPhase } from '../recording/recordingPhase'
import type { Selection } from '../store/mapStore'
import { DIFFICULTIES } from '../trails/difficulty'
import { gpxImportAlert, type GpxImportFailure } from '../trails/importAlerts'
import type { ShowTrailOutcome } from '../trails/showTrail'
import {
  agentSessionOnly,
  devcheckOnly,
  hook,
  isDevcheckName,
  mapInFront,
  messageOf,
  noArguments,
  noOwnerRecording,
  notWhileRecording,
  ok,
  recordingOwner,
  refused,
  WHILE_RECORDING,
  type AgentSessionRecord,
  type Hook,
  type LiveSession,
} from './hook'

interface StateRead {
  selection: Selection | null
  mapMode: MapMode
  followMode: FollowMode
  recording: RecordingPhase
  // The identity the build command gave the build, as the launch line carries it.
  build: unknown
}

type CaptureCheckRefusal = Exclude<CaptureCheck, 'ready'>

type Kind = Selection['kind']

// A trail or an activity, by its id.
type ItemRef = { kind: Kind; id: number }

interface Listed {
  id: number
  name: string
}

// Where a snapshot's two files lie in the hook folder, as paths adb pulls.
export interface SnapshotFiles {
  database: string
  preferences: string
}

// A GPX the toolkit pushed into the hook folder, imported under the name the request gives.
interface HookFolderImport {
  file: string
  name: string
  difficulty: Difficulty
}

// What the hooks call in the app, the screens' own functions: injected, so a test fakes them.
export interface Cores {
  readState(): StateRead
  recordingPhase(): RecordingPhase
  // The trails or the activities, as their list screen shows them.
  listed(kind: Kind): Listed[]
  showTrail(id: number): ShowTrailOutcome
  showActivity(id: number): ShowActivityOutcome
  clearSelection(): void
  // The database's consistent copy and the preferences without the last camera, in the hook folder.
  takeSnapshot(): Promise<SnapshotFiles>
  // A trail goes with its offline map, its activities unlinked, as the screen's delete does.
  deleteItem(kind: Kind, id: number): Promise<void>
  importTrail(request: HookFolderImport): Promise<{ ok: true; id: number } | { ok: false; failure: GpxImportFailure }>
  liveSession(): LiveSession | null
  agentSession: AgentSessionRecord
  // A start from the map through the gate that prompts for nothing.
  startRecording(): Promise<'started' | 'already-active' | CaptureCheckRefusal>
  pauseRecording(): Promise<void>
  // A resume through the gate that prompts for nothing.
  resumeRecording(): Promise<'resumed' | CaptureCheckRefusal>
  discardRecording(sessionId: number): Promise<void>
  stopForSave(): Promise<void>
  loadRecording(): Promise<LoadedRecording | null>
  saveRecording(recording: LoadedRecording, fields: ActivityFormFields): Promise<number>
}

const isKind = (value: unknown): value is Kind => value === 'trail' || value === 'activity'

const kindOnly = (args: Record<string, unknown>): { kind: Kind } => {
  if (Object.keys(args).length !== 1 || !isKind(args.kind)) throw new Error('expected { kind: "trail" | "activity" }')
  return { kind: args.kind }
}

const ITEM_ARGUMENTS = 'expected { kind: "trail" | "activity", id: <integer> }'

const itemArgs = (args: Record<string, unknown>): ItemRef => {
  const { kind, id } = args
  if (Object.keys(args).length !== 2 || !isKind(kind) || typeof id !== 'number' || !Number.isInteger(id)) throw new Error(ITEM_ARGUMENTS)
  return { kind, id }
}

const listedItem = (cores: Cores, { kind, id }: ItemRef) => cores.listed(kind).find((item) => item.id === id) ?? null

const namesOf = (item: Listed | null) => (item ? [item.name] : [])

const inTheList = (item: ItemRef, _app: unknown, cores: Cores) => (listedItem(cores, item) ? null : `no ${item.kind} ${item.id}`)

// A single name, so a request reads nothing outside the hook folder.
function hookFolderFile(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w.-]+$/.test(value) || /^\.+$/.test(value)) throw new Error('expected the name of a file in the hook folder')
  return value
}

function trailName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('expected a name')
  return value
}

function difficulty(value: unknown): Difficulty {
  const known = DIFFICULTIES.find((d) => d === value)
  if (!known) throw new Error('expected difficulty "easy", "medium" or "hard"')
  return known
}

// What a request carries besides the arguments its hook reads.
function noOtherArguments(rest: Record<string, unknown>): void {
  if (Object.keys(rest).length > 0) throw new Error(`unknown arguments: ${Object.keys(rest).join(', ')}`)
}

function importArguments(args: Record<string, unknown>): HookFolderImport {
  const { file, name, difficulty: level, ...rest } = args
  noOtherArguments(rest)
  return { file: hookFolderFile(file), name: trailName(name), difficulty: difficulty(level) }
}

// Activities first, so a trail's delete has no DEVCHECK activity left to unlink.
const CLEANUP_ORDER: Kind[] = ['activity', 'trail']

// Every DEVCHECK item, each delete apart: one that fails is named and the rest still go.
async function deleteEveryDevcheckItem(cores: Cores) {
  const deleted: (Listed & ItemRef)[] = []
  const failed: (Listed & ItemRef & { reason: string })[] = []
  for (const kind of CLEANUP_ORDER) {
    for (const { id, name } of cores.listed(kind).filter((item) => isDevcheckName(item.name))) {
      try {
        await cores.deleteItem(kind, id)
        deleted.push({ kind, id, name })
      } catch (error) {
        failed.push({ kind, id, name, reason: messageOf(error) })
      }
    }
  }
  return { deleted, failed }
}

// The cores' own answers, should a recording start between the guards and the core: anything but
// shown is a recording's.
function select({ kind, id }: ItemRef, cores: Cores) {
  const shown = (kind === 'activity' ? cores.showActivity(id) : cores.showTrail(id)).kind === 'shown'
  return shown ? ok(null) : refused(WHILE_RECORDING)
}

const CAPTURE_REFUSALS: Record<CaptureCheckRefusal | 'already-active', string> = {
  'already-active': 'a recording is already live',
  'permission-missing': 'location access "All the time" is missing; grant it on the phone',
  'location-off': 'location is off; turn it on',
  'app-behind': 'On Foot is not in front',
}

// The guards ran before: the live session is the agent session.
const agentSessionId = (cores: Cores) => cores.liveSession()?.id

const pausedOnly = (_args: unknown, _app: unknown, cores: Cores) =>
  cores.liveSession()?.paused ? null : 'only a paused agent session is saved; pause it first'

interface SaveArguments {
  name: string
  effort: Effort
}

function saveArguments(args: Record<string, unknown>): SaveArguments {
  const { name, effort, ...rest } = args
  noOtherArguments(rest)
  if (typeof name !== 'string') throw new Error('name must be a string')
  if (!EFFORTS.includes(effort as Effort)) throw new Error(`effort must be one of ${EFFORTS.join(', ')}`)
  return { name, effort: effort as Effort }
}

// Every hook the app answers, by the name the toolkit sends.
export const HOOKS: Record<string, Hook<Cores>> = {
  state: hook({
    parse: noArguments,
    guards: [],
    run: async (_args, cores, app) =>
      ok({ screen: app.screen, ...cores.readState(), agentSession: (await recordingOwner(cores)) === 'agent' }),
  }),
  'record-start': hook<object, Cores>({
    parse: noArguments,
    guards: [mapInFront],
    run: async (_args, cores) => {
      const outcome = await cores.startRecording()
      if (outcome !== 'started') return refused(CAPTURE_REFUSALS[outcome])
      const live = cores.liveSession()
      if (!live) throw new Error('the recording started but no session is live')
      await cores.agentSession.keep(live.id)
      return ok({ sessionId: live.id })
    },
  }),
  'record-pause': hook<object, Cores>({
    parse: noArguments,
    guards: [mapInFront, agentSessionOnly],
    run: async (_args, cores) => {
      await cores.pauseRecording()
      return ok({ sessionId: agentSessionId(cores) })
    },
  }),
  'record-resume': hook<object, Cores>({
    parse: noArguments,
    guards: [mapInFront, agentSessionOnly],
    run: async (_args, cores) => {
      const outcome = await cores.resumeRecording()
      return outcome === 'resumed' ? ok({ sessionId: agentSessionId(cores) }) : refused(CAPTURE_REFUSALS[outcome])
    },
  }),
  'record-discard': hook<object, Cores>({
    parse: noArguments,
    guards: [mapInFront, agentSessionOnly],
    run: async (_args, cores) => {
      const sessionId = agentSessionId(cores)
      if (sessionId === undefined) throw new Error('no recording is live')
      await cores.discardRecording(sessionId)
      await cores.agentSession.drop()
      return ok({ sessionId })
    },
  }),
  'record-save': hook<SaveArguments, Cores>({
    parse: saveArguments,
    guards: [mapInFront, agentSessionOnly, pausedOnly, devcheckOnly(({ name }) => [name])],
    run: async ({ name, effort }, cores) => {
      const sessionId = agentSessionId(cores)
      await cores.stopForSave()
      const recording = await cores.loadRecording()
      if (!recording || recording.session.id !== sessionId) throw new Error('the agent session ended before its save')
      const activityId = await cores.saveRecording(recording, { name, effort, comments: null })
      await cores.agentSession.drop()
      return ok({ sessionId, activityId })
    },
  }),
  // The owner's names never leave the app: only a count of them.
  list: hook({
    parse: kindOnly,
    guards: [],
    run: ({ kind }, cores) => {
      const items = cores.listed(kind)
      const devcheck = items.filter((item) => isDevcheckName(item.name)).map(({ id, name }) => ({ id, name }))
      return ok({ devcheck, others: items.length - devcheck.length })
    },
  }),
  select: hook({
    parse: itemArgs,
    guards: [notWhileRecording, inTheList],
    run: (args, cores: Cores) => select(args, cores),
  }),
  'clear-selection': hook({
    parse: noArguments,
    guards: [notWhileRecording],
    run: (_args, cores: Cores) => {
      cores.clearSelection()
      return ok(null)
    },
  }),
  snapshot: hook({
    parse: noArguments,
    guards: [],
    run: async (_args, cores) => ok(await cores.takeSnapshot()),
  }),
  delete: hook({
    parse: itemArgs,
    guards: [
      mapInFront,
      noOwnerRecording,
      inTheList,
      devcheckOnly((item: ItemRef, cores: Cores) => namesOf(listedItem(cores, item))),
    ],
    run: async ({ kind, id }, cores: Cores) => {
      const item = listedItem(cores, { kind, id })
      if (!item) return refused(`no ${kind} ${id}`)
      await cores.deleteItem(kind, id)
      return ok({ kind, id, name: item.name })
    },
  }),
  cleanup: hook<object, Cores>({
    parse: noArguments,
    guards: [mapInFront, noOwnerRecording],
    run: async (_args, cores) => ok(await deleteEveryDevcheckItem(cores)),
  }),
  'import-gpx': hook<HookFolderImport, Cores>({
    parse: importArguments,
    guards: [mapInFront, noOwnerRecording, devcheckOnly(({ name }) => [name])],
    run: async (request, cores) => {
      const imported = await cores.importTrail(request)
      return imported.ok ? ok({ id: imported.id, name: request.name }) : refused(`the GPX is not imported: ${gpxImportAlert(imported.failure).message}`)
    },
  }),
}
