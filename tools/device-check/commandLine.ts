import { parseArgs, type ParseArgsConfig } from 'node:util'
import { build } from './build'
import { buildHas, buildHolds } from './buildHas'
import { errorMessage } from './errorMessage'
import { devcheckName } from './devcheckData'
import { frames } from './frames'
import { listReport, recordReport, stateReport } from './hookReply'
import { hookData } from './hookData'
import { checkBurst } from './framesPlan'
import { back, typeText } from './keys'
import { readLog } from './logCommand'
import { crop, labels, scroll, shot, tap, waitFor, type TapOptions } from './look'
import { reportNativeErrors } from './nativeErrors'
import { writeRoute } from './routeFile'
import type { RouteStart } from './routeSpec'
import type { ScrollDirection } from './scrollPlan'
import { clearSnapshots, snapshot } from './snapshot'
import { typingScript } from './typing'
import { walkJump, walkStatus, walkStop, walkTo, type MoveOptions } from './walk'
import { cleanup, deleteItem, importGpx } from './writeHooks'
import { zoom } from './zoom'

export class UsageError extends Error {}

const num = (value: string | undefined, name: string): number | undefined => {
  if (value === undefined) return undefined
  const n = Number(value)
  if (!Number.isFinite(n)) throw new UsageError(`--${name} must be a number`)
  return n
}

const exactly = (positionals: string[], count: number, what: string): string[] => {
  if (positionals.length !== count) throw new UsageError(`expected ${what}`)
  return positionals
}

// node's parseArgs, its refusals (an unknown option, a missing value) read as usage errors.
function options<T extends NonNullable<ParseArgsConfig['options']>>(args: string[], spec: T) {
  try {
    return parseArgs({ args, allowPositionals: true, options: spec })
  } catch (error) {
    throw new UsageError(errorMessage(error))
  }
}

// A check of a pure precondition, its refusal read as a usage error.
function usage(check: () => void): void {
  try {
    check()
  } catch (error) {
    throw new UsageError(errorMessage(error))
  }
}

function point(value: string | undefined, message: string): [number, number] | undefined {
  const parts = value?.split(',').map(Number)
  if (parts && (parts.length !== 2 || parts.some((n) => !Number.isFinite(n)))) throw new UsageError(message)
  return parts && [parts[0], parts[1]]
}

// One toolkit command, declared once: everything the usage text, the parser, the runner, a `do`
// list and the recorder know of it is read from here.
interface Entry<P> {
  // The signature, its leading lowercase words naming the command (`walk to`, `tap`).
  usage: string
  // What it does, one printed line each.
  help: string[]
  // The arguments after the command's words, read into what it runs on; nothing runs.
  parse(args: string[]): P
  // Its result, printed by the caller; a command that streams its progress prints that itself.
  run(command: P): Promise<string | undefined> | string | undefined
  // A `do` list takes it, or refuses it for this reason.
  step: true | { refused: string }
  // A command that reaches the phone starts the recorder first, so a check is recorded from its
  // first command.
  startsTheRecorder: boolean
}

const entry = <P>(declared: Entry<P>) => declared

const A_WRITE = "a write to the app's data: run it on its own, so its answer is read before the next command"
const A_MOVE = 'a move is a long wait: run it on its own, in the background, so the harness reports its end'

const WALK_OPTIONS = {
  pace: { type: 'string' },
  route: { type: 'string' },
  offset: { type: 'string' },
  accuracy: { type: 'string' },
  force: { type: 'boolean', default: false },
} as const

// Every `walk` action takes every walk option.
function walkArgs(args: string[]) {
  const { values, positionals } = options(args, WALK_OPTIONS)
  const move: MoveOptions = { route: values.route, offset: num(values.offset, 'offset'), accuracy: num(values.accuracy, 'accuracy') }
  return { values, positionals, move }
}

// The app's difficulties (src/trails/difficulty.ts) as the command line spells them; the
// cross-check test holds the two together.
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

// A trail or an activity by the id `list` gives.
function itemArgs(args: string[], signature: string): { kind: 'trail' | 'activity'; id: number } {
  const [kind, id] = exactly(args, 2, signature)
  if (kind !== 'trail' && kind !== 'activity') throw new UsageError(`expected ${signature}`)
  if (!/^\d+$/.test(id)) throw new UsageError('the id must be a whole number, as `list` gives it')
  return { kind, id: Number(id) }
}

const noArguments = (name: string) => (args: string[]) => {
  exactly(args, 0, `${name} with no arguments`)
  return {}
}

// The app's efforts (src/activities/effort.ts) as the command line spells them; held as the
// difficulties are.
export const EFFORTS = ['Easy', 'Moderate', 'Hard', 'Max']

const AN_AGENT_SESSION = 'it drives a recording: run it on its own'

// `record start|pause|resume|discard`: one hook each, on the agent session.
const recordAction = (action: 'start' | 'pause' | 'resume' | 'discard', help: string[]) =>
  entry({
    usage: `record ${action}`,
    help,
    parse: noArguments(`record ${action}`),
    run: async () => recordReport(`record-${action}`, await hookData(`record-${action}`)),
    step: { refused: AN_AGENT_SESSION },
    startsTheRecorder: true,
  })

const COMMANDS = {
  'walk-to': entry({
    usage: 'walk to <mark|end> --pace walk|fast|<m/s> [--route FILE] [--offset M] [--accuracy M]',
    help: ['move along the route, one fix a second; returns at the mark'],
    parse: (args: string[]) => {
      const { values, positionals, move } = walkArgs(args)
      return { mark: exactly(positionals, 1, 'walk to <mark>')[0], pace: values.pace, options: move }
    },
    run: (c) => walkTo(c.mark, c.pace, c.options),
    step: { refused: A_MOVE },
    startsTheRecorder: true,
  }),
  'walk-jump': entry({
    usage: 'walk jump <mark|end> [--route FILE] [--offset M] [--accuracy M]',
    help: ['put the position at a mark; refused while recording'],
    parse: (args: string[]) => {
      const { positionals, move } = walkArgs(args)
      return { mark: exactly(positionals, 1, 'walk jump <mark>')[0], options: move }
    },
    run: (c) => walkJump(c.mark, c.options),
    step: { refused: A_MOVE },
    startsTheRecorder: true,
  }),
  // `walk status` and `walk stop` close a check after `cleanup` has stopped the recorder.
  'walk-status': entry({
    usage: 'walk status',
    help: ['route, mark, offset, whether a walk moves, whether the mock is on'],
    parse: (args: string[]) => {
      walkArgs(args)
      return {}
    },
    run: () => walkStatus(),
    step: { refused: A_MOVE },
    startsTheRecorder: false,
  }),
  'walk-stop': entry({
    usage: 'walk stop [--force]',
    help: ['stop the mock, the phone is back on real GPS (--force: a moving walk too)'],
    parse: (args: string[]) => ({ force: walkArgs(args).values.force }),
    run: (c) => walkStop(c.force),
    step: { refused: A_MOVE },
    startsTheRecorder: false,
  }),
  route: entry({
    usage: 'route <name> <stretch>... [--from LAT,LNG] [--bearing DEG] [--ele M]',
    help: ['write a DEVCHECK GPX; stretch = LENGTH, LENGTH:GRADE% or LENGTH:noele'],
    parse: (args: string[]) => {
      const { values, positionals } = options(args, { from: { type: 'string' }, bearing: { type: 'string' }, ele: { type: 'string' } })
      const [name, ...stretches] = positionals
      if (!name) throw new UsageError('expected route <name> <stretch>...')
      const from = point(values.from, '--from must be LAT,LNG')
      const start: Partial<RouteStart> = {
        ...(from ? { lat: from[0], lng: from[1] } : {}),
        ...(values.bearing !== undefined ? { bearing: num(values.bearing, 'bearing') } : {}),
        ...(values.ele !== undefined ? { ele: num(values.ele, 'ele') } : {}),
      }
      return { name, stretches, start }
    },
    run: (c) => writeRoute(c.name, c.stretches, c.start),
    step: { refused: 'it writes a file and touches no phone: run it on its own' },
    startsTheRecorder: false,
  }),
  'import-gpx': entry({
    usage: 'import-gpx <file> [--difficulty Easy|Medium|Hard]',
    help: ['push a DEVCHECK GPX into the hook folder and import it through a check hook;', "prints the new trail's id"],
    parse: (args: string[]) => {
      const { values, positionals } = options(args, { difficulty: { type: 'string', default: 'Easy' } })
      const file = exactly(positionals, 1, 'import-gpx <file>')[0]
      if (!DIFFICULTIES.includes(values.difficulty)) throw new UsageError(`--difficulty must be one of ${DIFFICULTIES.join(', ')}`)
      return { file, difficulty: values.difficulty.toLowerCase() }
    },
    run: (c) => importGpx(c.file, c.difficulty),
    step: { refused: A_WRITE },
    startsTheRecorder: true,
  }),
  'record-start': recordAction('start', [
    'start an agent session through a check hook; refused, never prompting, when a',
    'permission is missing, location is off, the app is behind or a recording is live',
  ]),
  'record-pause': recordAction('pause', ['pause the agent session; refused on a recording a hook did not start']),
  'record-resume': recordAction('resume', ['resume the agent session; refused, never prompting, as record start is']),
  'record-discard': recordAction('discard', ['discard the agent session; refused on a recording a hook did not start']),
  'record-save': entry({
    usage: 'record save <name> [--effort Easy|Moderate|Hard|Max]',
    help: ['save the paused agent session as the activity DEVCHECK <name>, linked to', 'the trail shown'],
    parse: (args: string[]) => {
      const { values, positionals } = options(args, { effort: { type: 'string', default: 'Easy' } })
      const name = devcheckName(exactly(positionals, 1, 'record save <name>')[0])
      if (!EFFORTS.includes(values.effort)) throw new UsageError(`--effort must be one of ${EFFORTS.join(', ')}`)
      return { name, effort: values.effort.toLowerCase() }
    },
    run: async (c) => recordReport('record-save', await hookData('record-save', { name: c.name, effort: c.effort })),
    step: { refused: AN_AGENT_SESSION },
    startsTheRecorder: true,
  }),
  delete: entry({
    usage: 'delete trail|activity <id>',
    help: ['delete one DEVCHECK item through a check hook, a trail with its offline map'],
    parse: (args: string[]) => itemArgs(args, 'delete trail|activity <id>'),
    run: (c) => deleteItem(c.kind, c.id),
    step: { refused: A_WRITE },
    startsTheRecorder: true,
  }),
  // It stops the recorder itself, and a dead recorder's failure is reported there, not in the way.
  cleanup: entry({
    usage: 'cleanup',
    help: [
      'go back to the map, then delete every DEVCHECK activity, then trail, in one check',
      'hook; prints what it deleted and what not; unless a walk moves, stops the reader',
      'and the recorder and copies the capture into the evidence folder; deletes the',
      'snapshots from the evidence folder and empties the hook folder',
    ],
    parse: noArguments('cleanup'),
    run: async () => {
      const cleaned = await cleanup()
      console.log(await clearSnapshots())
      if (!cleaned) process.exitCode = 1
      return undefined
    },
    step: { refused: A_WRITE },
    startsTheRecorder: false,
  }),
  labels: entry({
    usage: 'labels',
    help: ['the labels on screen in one line, and the time the read took; no file'],
    parse: noArguments('labels'),
    run: () => labels(),
    step: true,
    startsTheRecorder: true,
  }),
  shot: entry({
    usage: 'shot <name>',
    help: ['screenshot NN-name.png, a half-width copy to read, dump and labels'],
    parse: (args: string[]) => ({ name: exactly(args, 1, 'shot <name>')[0] }),
    run: (c) => shot(c.name),
    step: true,
    startsTheRecorder: true,
  }),
  frames: entry({
    usage: 'frames <name> --count N --every MS',
    help: ["N screenshots MS apart, one half-width strip NN-name.strip.png, each frame's time"],
    parse: (args: string[]) => {
      const { values, positionals } = options(args, { count: { type: 'string' }, every: { type: 'string' } })
      const [name] = exactly(positionals, 1, 'frames <name> --count N --every MS')
      const count = num(values.count, 'count')
      const everyMs = num(values.every, 'every')
      if (count === undefined || everyMs === undefined) throw new UsageError('frames needs --count N and --every MS')
      usage(() => checkBurst(count, everyMs))
      return { name, count, everyMs }
    },
    run: (c) => frames(c.name, c.count, c.everyMs),
    step: true,
    startsTheRecorder: true,
  }),
  crop: entry({
    usage: 'crop <shot> <label>',
    help: ['cut a shot to one control, found by label in its dump'],
    parse: (args: string[]) => {
      const [ref, label] = exactly(args, 2, 'crop <shot> <label>')
      return { ref, label }
    },
    run: (c) => crop(c.ref, c.label),
    step: true,
    startsTheRecorder: true,
  }),
  tap: entry({
    usage: 'tap <label> [--hold MS] [--until <label> | --until-gone <label>] [--timeout S]',
    help: [
      'tap (or long-press) the control with this label or text once it stands still,',
      'then wait for the label to appear (or go; default 10 s) or for the screen to',
      'settle; prints what it caused and the labels on screen',
    ],
    parse: (args: string[]) => {
      const { values, positionals } = options(args, {
        hold: { type: 'string' },
        until: { type: 'string' },
        'until-gone': { type: 'string' },
        timeout: { type: 'string' },
      })
      const [label] = exactly(positionals, 1, 'tap <label>')
      const until = values['until-gone'] ?? values.until
      if (values.until !== undefined && values['until-gone'] !== undefined) throw new UsageError('tap takes --until or --until-gone, not both')
      if (values.timeout !== undefined && until === undefined) throw new UsageError('--timeout bounds --until or --until-gone')
      const tapOptions: TapOptions = {
        holdMs: num(values.hold, 'hold'),
        until: until === undefined ? undefined : { label: until, gone: values['until-gone'] !== undefined },
        timeoutS: num(values.timeout, 'timeout'),
      }
      return { label, options: tapOptions }
    },
    run: (c) => tap(c.label, c.options),
    step: true,
    startsTheRecorder: true,
  }),
  scroll: entry({
    usage: 'scroll up|down',
    help: [
      'drag the largest list on screen by a third of its height (down: the rows below),',
      'then wait for it to settle; prints what it caused and the labels on screen',
    ],
    parse: (args: string[]): { direction: ScrollDirection } => {
      const [direction] = exactly(args, 1, 'scroll up|down')
      if (direction !== 'up' && direction !== 'down') throw new UsageError('expected scroll up|down')
      return { direction }
    },
    run: (c) => scroll(c.direction),
    step: true,
    startsTheRecorder: true,
  }),
  back: entry({
    usage: 'back',
    help: [
      'press the back key, then wait for the screen to settle; prints what it caused',
      'and the labels on screen',
    ],
    parse: noArguments('back'),
    run: () => back(),
    step: true,
    startsTheRecorder: true,
  }),
  type: entry({
    usage: 'type <text>',
    help: ['type the text into the focused field (printable ASCII; spaces as they are)'],
    parse: (args: string[]) => {
      const [text] = exactly(args, 1, "type '<text>'")
      usage(() => typingScript(text))
      return { text }
    },
    run: (c) => typeText(c.text),
    step: true,
    startsTheRecorder: true,
  }),
  zoom: entry({
    usage: 'zoom in|out [--at X,Y] [--steps N]',
    help: ['two-finger pinch about a point (default: the screen centre), 10 steps'],
    parse: (args: string[]): { direction: 'in' | 'out'; at: { x: number; y: number } | undefined; steps: number } => {
      const { values, positionals } = options(args, { at: { type: 'string' }, steps: { type: 'string', default: '10' } })
      const [direction] = exactly(positionals, 1, 'zoom in|out')
      if (direction !== 'in' && direction !== 'out') throw new UsageError('expected zoom in|out')
      const at = point(values.at, '--at must be X,Y in screen pixels')
      return { direction, at: at && { x: at[0], y: at[1] }, steps: num(values.steps, 'steps') ?? 10 }
    },
    run: (c) => zoom(c.direction, c.at, c.steps),
    step: true,
    startsTheRecorder: true,
  }),
  'wait-for': entry({
    usage: 'wait-for <label> [--gone] [--timeout S]',
    help: ['wait for a label or text to appear (or go); prints the time waited'],
    parse: (args: string[]) => {
      const { values, positionals } = options(args, { gone: { type: 'boolean', default: false }, timeout: { type: 'string', default: '20' } })
      return { label: exactly(positionals, 1, 'wait-for <label>')[0], gone: values.gone, timeoutS: num(values.timeout, 'timeout') ?? 20 }
    },
    run: (c) => waitFor(c.label, c.gone, c.timeoutS),
    step: true,
    startsTheRecorder: true,
  }),
  state: entry({
    usage: 'state',
    help: [
      "the app's state through a check hook: the screen in front, the selection, the",
      'map and follow modes, the recording phase and whether it is an agent session,',
      "the build's identity; launches On Foot and waits until it has loaded when no",
      'hook answers',
    ],
    parse: noArguments('state'),
    run: async () => stateReport(await hookData('state')),
    step: true,
    startsTheRecorder: true,
  }),
  list: entry({
    usage: 'list trails|activities',
    help: ['the DEVCHECK trails (or activities) by id and name, and how many others there are'],
    parse: (args: string[]): { kind: 'trail' | 'activity' } => {
      const [plural] = exactly(args, 1, 'list trails|activities')
      if (plural !== 'trails' && plural !== 'activities') throw new UsageError('expected list trails|activities')
      return { kind: plural === 'trails' ? 'trail' : 'activity' }
    },
    run: async (c) => listReport(c.kind, await hookData('list', { kind: c.kind })),
    step: true,
    startsTheRecorder: true,
  }),
  select: entry({
    usage: 'select trail|activity <id>',
    help: ['show the trail (or activity) on the map, as its list row does; refused while recording'],
    parse: (args: string[]) => itemArgs(args, 'select trail|activity <id>'),
    run: async (c) => {
      await hookData('select', { kind: c.kind, id: c.id })
      return `selected ${c.kind} ${c.id}`
    },
    step: true,
    startsTheRecorder: true,
  }),
  'clear-selection': entry({
    usage: 'clear-selection',
    help: ['show nothing on the map; refused while recording'],
    parse: noArguments('clear-selection'),
    run: async () => {
      await hookData('clear-selection')
      return 'selection cleared'
    },
    step: true,
    startsTheRecorder: true,
  }),
  snapshot: entry({
    usage: 'snapshot',
    help: [
      "the app's database (a consistent copy) and its stored preferences (without the",
      "last camera) into the evidence folder, through a check hook, then deleted on the",
      'phone; prints the two paths',
    ],
    parse: noArguments('snapshot'),
    run: () => snapshot(),
    step: true,
    startsTheRecorder: true,
  }),
  build: entry({
    usage: 'build',
    help: [
      "compute the build's identity, then build the release with check hooks,",
      'install it and open it; prints the identity first',
    ],
    parse: noArguments('build'),
    run: async () => {
      process.exitCode = await build()
      return undefined
    },
    step: { refused: 'a build takes many minutes: run it on its own, in the background' },
    // It installs and opens the app, whose launch the next command's recorder copies in from logcat.
    startsTheRecorder: false,
  }),
  'build-has': entry({
    usage: 'build-has <string> | --commit <rev>',
    help: [
      'whether the installed JS bundle contains the string; with --commit, whether the',
      'installed build holds the commit, from the identity `state` gives, or on a build',
      "without hooks the capture's last launch",
    ],
    parse: (args: string[]) =>
      args[0] === '--commit'
        ? { text: exactly(args.slice(1), 1, 'build-has --commit <rev>')[0], commit: true }
        : { text: exactly(args, 1, 'build-has <string> | --commit <rev>')[0], commit: false },
    run: async (c) => {
      if (c.commit) {
        const { held, report } = await buildHolds(c.text)
        if (!held) process.exitCode = 1
        return report
      }
      const { found, report } = await buildHas(c.text)
      if (!found) process.exitCode = 1
      return report
    },
    step: { refused: 'it pulls the installed bundle, a long wait: run it on its own, in the background' },
    startsTheRecorder: true,
  }),
  log: entry({
    usage: 'log [--area AREA]...',
    help: [
      "the app's debug-log entries recorded since the check's first command, every",
      "process, oldest first, then the capture's path; --area keeps one area (repeat it)",
    ],
    parse: (args: string[]) => {
      const { values, positionals } = options(args, { area: { type: 'string', multiple: true, default: [] } })
      exactly(positionals, 0, 'log [--area AREA]...')
      return { areas: values.area }
    },
    run: (c) => readLog(c.areas),
    step: true,
    startsTheRecorder: true,
  }),
  'native-errors': entry({
    usage: 'native-errors',
    help: [
      "Mapbox layer/source, ReactNativeJS and FATAL lines from logcat since",
      "On Foot's process started, positions redacted; exits 1 on any",
    ],
    parse: noArguments('native-errors'),
    run: async () => {
      const { found, report } = await reportNativeErrors()
      if (found) process.exitCode = 1
      return report
    },
    step: { refused: 'its finding is its exit code, not a failure: run it on its own' },
    startsTheRecorder: true,
  }),
}

type Kind = keyof typeof COMMANDS
type Payloads = { [K in Kind]: ReturnType<(typeof COMMANDS)[K]['parse']> }
const REGISTRY: { [K in Kind]: Entry<Payloads[K]> } = COMMANDS

export type Command = { [K in Kind]: { command: K } & Payloads[K] }[Kind]

const commandWords = (signature: string): string[] => {
  const words = signature.split(' ')
  const end = words.findIndex((word) => !/^[a-z][a-z-]*$/.test(word))
  return end === -1 ? words : words.slice(0, end)
}

const NAMED = (Object.keys(REGISTRY) as Kind[]).map((kind) => ({ kind, words: commandWords(REGISTRY[kind].usage) }))

// The commands a `do` list may hold, and why it refuses the others, each by its first word.
export const STEPS = [...new Set(NAMED.filter(({ kind }) => REGISTRY[kind].step === true).map(({ words }) => words[0]))]

// `do` runs a list of commands; it is not one of them.
const DO = {
  usage: 'do <step>...',
  help: [
    'run the steps in order, one quoted command line each, all read before the first',
    'runs; stops at the first failure with its exit code; a step is one of',
    STEPS.join(', '),
  ],
  refused: 'a step list cannot hold another list',
}

export const REFUSED: Record<string, string> = {
  ...Object.fromEntries(NAMED.flatMap(({ kind, words }) => {
    const { step } = REGISTRY[kind]
    return step === true ? [] : [[words[0], step.refused]]
  })),
  do: DO.refused,
}

const HELP_COLUMN = 34

function usageLines({ usage, help: [first, ...more] }: { usage: string; help: string[] }): string[] {
  const indent = ' '.repeat(HELP_COLUMN)
  const head = usage.length <= HELP_COLUMN - 4 ? [`  ${usage.padEnd(HELP_COLUMN - 2)}${first}`] : [`  ${usage}`, `${indent}${first}`]
  return [...head, ...more.map((line) => `${indent}${line}`)]
}

export const USAGE = ['devcheck <command>', '', ...[...Object.values(REGISTRY), DO].flatMap(usageLines)].join('\n')

export const startsTheRecorder = ({ command }: Command) => REGISTRY[command].startsTheRecorder

// A command line of the toolkit, read into the command it names; nothing runs.
export function parseCommand(argv: string[]): Command {
  const [first, ...rest] = argv
  if (!first) throw new UsageError('no command')
  const named = NAMED.filter(({ words }) => words[0] === first)
  if (named.length === 0) throw new UsageError(`unknown command "${first}"`)
  const [action, ...afterAction] = rest
  const found = named.find(({ words }) => words.length === 1 || words[1] === action)
  if (!found) throw new UsageError(`unknown ${first} action "${action ?? ''}"`)
  const args = found.words.length === 1 ? rest : afterAction
  // The kind and the payload come from the same entry, a pairing the union cannot express.
  return { command: found.kind, ...REGISTRY[found.kind].parse(args) } as Command
}

const run = <K extends Kind>(kind: K, command: Payloads[K]) => REGISTRY[kind].run(command)

export async function runCommand(command: Command): Promise<string | undefined> {
  return run(command.command, command)
}
