import { parseArgs, type ParseArgsConfig } from 'node:util'
import { errorMessage } from './errorMessage'
import { checkBurst } from './framesPlan'
import type { TapOptions } from './look'
import type { RouteStart } from './routeSpec'
import type { ScrollDirection } from './scrollPlan'
import { typingScript } from './typing'
import type { MoveOptions } from './walk'

export class UsageError extends Error {}

// The commands a `do` list may hold.
export const STEPS = ['tap', 'wait-for', 'labels', 'shot', 'frames', 'crop', 'zoom', 'scroll', 'back', 'type', 'log']

export const USAGE = `devcheck <command>

  walk to <mark|end> --pace walk|fast|<m/s> [--route FILE] [--offset M] [--accuracy M]
                                  move along the route, one fix a second; returns at the mark
  walk jump <mark|end> [--route FILE] [--offset M] [--accuracy M]
                                  put the position at a mark; refused while recording
  walk status                     route, mark, offset, whether a walk moves, whether the mock is on
  walk stop [--force]             stop the mock, the phone is back on real GPS (--force: a moving walk too)
  route <name> <stretch>... [--from LAT,LNG] [--bearing DEG] [--ele M]
                                  write a DEVCHECK GPX; stretch = LENGTH, LENGTH:GRADE% or LENGTH:noele
  import-gpx <file> [--difficulty Easy|Medium|Hard]
                                  push a DEVCHECK GPX and import it through the app's picker
  save-activity <name> [--effort Easy|Moderate|Hard|Max]
                                  pause, stop, name (DEVCHECK prefixed) and save the recording
  delete trail|activity <name>    delete one DEVCHECK item through its list, confirming only a dialog naming it
  cleanup                         delete every DEVCHECK activity, then trail; prints what it deleted and what not;
                                  then goes back to the map and, unless a walk moves, stops the reader and the
                                  recorder and copies the capture into the evidence folder
  labels                          the labels on screen in one line, and the time the read took; no file
  shot <name>                     screenshot NN-name.png, a half-width copy to read, dump and labels
  frames <name> --count N --every MS
                                  N screenshots MS apart, one half-width strip NN-name.strip.png, each frame's time
  crop <shot> <label>             cut a shot to one control, found by label in its dump
  tap <label> [--hold MS] [--until <label> | --until-gone <label>] [--timeout S]
                                  tap (or long-press) the control with this label or text once it stands still,
                                  then wait for the label to appear (or go; default 10 s) or for the screen to
                                  settle; prints what it caused and the labels on screen
  scroll up|down                  drag the largest list on screen by a third of its height (down: the rows below),
                                  then wait for it to settle; prints what it caused and the labels on screen
  back                            press the back key, then wait for the screen to settle; prints what it caused
                                  and the labels on screen
  type <text>                     type the text into the focused field (printable ASCII; spaces as they are)
  zoom in|out [--at X,Y] [--steps N]
                                  two-finger pinch about a point (default: the screen centre), 10 steps
  wait-for <label> [--gone] [--timeout S]
                                  wait for a label or text to appear (or go); prints the time waited
  build-has <string>              whether the installed JS bundle contains the string
  log [--area AREA]...            the app's debug-log entries recorded since the check's first command, every
                                  process, oldest first, then the capture's path; --area keeps one area (repeat it)
  native-errors                   Mapbox layer/source, ReactNativeJS and FATAL lines from logcat since
                                  On Foot's process started, positions redacted; exits 1 on any
  do <step>...                    run the steps in order, one quoted command line each, all read before the first
                                  runs; stops at the first failure with its exit code; a step is one of
                                  ${STEPS.join(', ')}`

export type Command =
  | { command: 'walk-to'; mark: string; pace: string | undefined; options: MoveOptions }
  | { command: 'walk-jump'; mark: string; options: MoveOptions }
  | { command: 'walk-status' }
  | { command: 'walk-stop'; force: boolean }
  | { command: 'route'; name: string; stretches: string[]; start: Partial<RouteStart> }
  | { command: 'import-gpx'; file: string; difficulty: string }
  | { command: 'save-activity'; name: string; effort: string }
  | { command: 'delete'; kind: 'trail' | 'activity'; name: string }
  | { command: 'cleanup' }
  | { command: 'labels' }
  | { command: 'shot'; name: string }
  | { command: 'frames'; name: string; count: number; everyMs: number }
  | { command: 'crop'; ref: string; label: string }
  | { command: 'tap'; label: string; options: TapOptions }
  | { command: 'scroll'; direction: ScrollDirection }
  | { command: 'back' }
  | { command: 'type'; text: string }
  | { command: 'zoom'; direction: 'in' | 'out'; at: { x: number; y: number } | undefined; steps: number }
  | { command: 'wait-for'; label: string; gone: boolean; timeoutS: number }
  | { command: 'build-has'; text: string }
  | { command: 'log'; areas: string[] }
  | { command: 'native-errors' }

// A command that reaches the phone starts the recorder first, so a check is recorded from its first
// command. `route` touches no phone; `cleanup` stops the recorder, and a dead one's failure is
// reported there, not in the way; `walk status` and `walk stop` close a check after it.
const LEAVE_THE_RECORDER = new Set<Command['command']>(['route', 'cleanup', 'walk-status', 'walk-stop'])
export const startsTheRecorder = ({ command }: Command) => !LEAVE_THE_RECORDER.has(command)

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

function walk(args: string[]): Command {
  const [action, ...rest] = args
  const { values, positionals } = options(rest, {
    pace: { type: 'string' },
    route: { type: 'string' },
    offset: { type: 'string' },
    accuracy: { type: 'string' },
    force: { type: 'boolean', default: false },
  })
  const moveOptions = { route: values.route, offset: num(values.offset, 'offset'), accuracy: num(values.accuracy, 'accuracy') }
  switch (action) {
    case 'to': return { command: 'walk-to', mark: exactly(positionals, 1, 'walk to <mark>')[0], pace: values.pace, options: moveOptions }
    case 'jump': return { command: 'walk-jump', mark: exactly(positionals, 1, 'walk jump <mark>')[0], options: moveOptions }
    case 'status': return { command: 'walk-status' }
    case 'stop': return { command: 'walk-stop', force: values.force }
    default: throw new UsageError(`unknown walk action "${action ?? ''}"`)
  }
}

// A command line of the toolkit, read into the command it names; nothing runs.
export function parseCommand(argv: string[]): Command {
  const [command, ...args] = argv
  switch (command) {
    case 'walk': return walk(args)
    case 'route': {
      const { values, positionals } = options(args, { from: { type: 'string' }, bearing: { type: 'string' }, ele: { type: 'string' } })
      const [name, ...stretches] = positionals
      if (!name) throw new UsageError('expected route <name> <stretch>...')
      const from = point(values.from, '--from must be LAT,LNG')
      return {
        command: 'route',
        name,
        stretches,
        start: {
          ...(from ? { lat: from[0], lng: from[1] } : {}),
          ...(values.bearing !== undefined ? { bearing: num(values.bearing, 'bearing') } : {}),
          ...(values.ele !== undefined ? { ele: num(values.ele, 'ele') } : {}),
        },
      }
    }
    case 'import-gpx': {
      const { values, positionals } = options(args, { difficulty: { type: 'string', default: 'Easy' } })
      return { command: 'import-gpx', file: exactly(positionals, 1, 'import-gpx <file>')[0], difficulty: values.difficulty }
    }
    case 'save-activity': {
      const { values, positionals } = options(args, { effort: { type: 'string', default: 'Easy' } })
      return { command: 'save-activity', name: exactly(positionals, 1, 'save-activity <name>')[0], effort: values.effort }
    }
    case 'delete': {
      const [kind, name] = exactly(args, 2, "delete trail|activity '<name>'")
      if (kind !== 'trail' && kind !== 'activity') throw new UsageError("expected delete trail|activity '<name>'")
      return { command: 'delete', kind, name }
    }
    case 'cleanup':
      exactly(args, 0, 'cleanup with no arguments')
      return { command: 'cleanup' }
    case 'labels':
      exactly(args, 0, 'labels with no arguments')
      return { command: 'labels' }
    case 'shot': return { command: 'shot', name: exactly(args, 1, 'shot <name>')[0] }
    case 'frames': {
      const { values, positionals } = options(args, { count: { type: 'string' }, every: { type: 'string' } })
      const [name] = exactly(positionals, 1, 'frames <name> --count N --every MS')
      const count = num(values.count, 'count')
      const everyMs = num(values.every, 'every')
      if (count === undefined || everyMs === undefined) throw new UsageError('frames needs --count N and --every MS')
      usage(() => checkBurst(count, everyMs))
      return { command: 'frames', name, count, everyMs }
    }
    case 'crop': {
      const [ref, label] = exactly(args, 2, 'crop <shot> <label>')
      return { command: 'crop', ref, label }
    }
    case 'tap': {
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
      return {
        command: 'tap',
        label,
        options: {
          holdMs: num(values.hold, 'hold'),
          until: until === undefined ? undefined : { label: until, gone: values['until-gone'] !== undefined },
          timeoutS: num(values.timeout, 'timeout'),
        },
      }
    }
    case 'scroll': {
      const [direction] = exactly(args, 1, 'scroll up|down')
      if (direction !== 'up' && direction !== 'down') throw new UsageError('expected scroll up|down')
      return { command: 'scroll', direction }
    }
    case 'back':
      exactly(args, 0, 'back with no arguments')
      return { command: 'back' }
    case 'type': {
      const [text] = exactly(args, 1, "type '<text>'")
      usage(() => typingScript(text))
      return { command: 'type', text }
    }
    case 'zoom': {
      const { values, positionals } = options(args, { at: { type: 'string' }, steps: { type: 'string', default: '10' } })
      const [direction] = exactly(positionals, 1, 'zoom in|out')
      if (direction !== 'in' && direction !== 'out') throw new UsageError('expected zoom in|out')
      const at = point(values.at, '--at must be X,Y in screen pixels')
      return { command: 'zoom', direction, at: at && { x: at[0], y: at[1] }, steps: num(values.steps, 'steps') ?? 10 }
    }
    case 'wait-for': {
      const { values, positionals } = options(args, { gone: { type: 'boolean', default: false }, timeout: { type: 'string', default: '20' } })
      return { command: 'wait-for', label: exactly(positionals, 1, 'wait-for <label>')[0], gone: values.gone, timeoutS: num(values.timeout, 'timeout') ?? 20 }
    }
    case 'build-has': return { command: 'build-has', text: exactly(args, 1, 'build-has <string>')[0] }
    case 'log': {
      const { values, positionals } = options(args, { area: { type: 'string', multiple: true, default: [] } })
      exactly(positionals, 0, 'log [--area AREA]...')
      return { command: 'log', areas: values.area }
    }
    case 'native-errors':
      exactly(args, 0, 'native-errors with no arguments')
      return { command: 'native-errors' }
    default: throw new UsageError(command ? `unknown command "${command}"` : 'no command')
  }
}
