import { parseArgs } from 'node:util'
import { lastSerial, PhoneGone } from './adb'
import { buildHas } from './buildHas'
import { importGpx, saveActivity } from './flows'
import { crop, shot, tap, waitFor } from './look'
import { writeRoute } from './routeFile'
import { walkJump, walkStatus, walkStop, walkTo } from './walk'
import { readMemory } from './walkStore'

const USAGE = `devcheck <command>

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
  shot <name>                     screenshot NN-name.png, a half-width copy to read, dump and labels
  crop <shot> <label>             cut a shot to one control, found by label in its dump
  tap <label> [--hold MS]         tap (or long-press) the control with this label or text
  wait-for <label> [--gone] [--timeout S]
                                  wait for a label or text to appear (or go); prints the time waited
  build-has <string>              whether the installed JS bundle contains the string`

const EXIT = { usage: 2, phoneGone: 3 }

class UsageError extends Error {}

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

async function walk(args: string[]): Promise<void> {
  const [action, ...rest] = args
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      pace: { type: 'string' },
      route: { type: 'string' },
      offset: { type: 'string' },
      accuracy: { type: 'string' },
      force: { type: 'boolean', default: false },
    },
  })
  const options = { route: values.route, offset: num(values.offset, 'offset'), accuracy: num(values.accuracy, 'accuracy') }
  switch (action) {
    case 'to': return walkTo(exactly(positionals, 1, 'walk to <mark>')[0], values.pace, options)
    case 'jump': return walkJump(exactly(positionals, 1, 'walk jump <mark>')[0], options)
    case 'status': return walkStatus()
    case 'stop': return walkStop(values.force)
    default: throw new UsageError(`unknown walk action "${action ?? ''}"`)
  }
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv
  switch (command) {
    case 'walk': return walk(args)
    case 'route': {
      const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        options: { from: { type: 'string' }, bearing: { type: 'string' }, ele: { type: 'string' } },
      })
      const [name, ...stretches] = positionals
      if (!name) throw new UsageError('expected route <name> <stretch>...')
      const from = values.from?.split(',').map(Number)
      if (from && (from.length !== 2 || from.some((n) => !Number.isFinite(n)))) throw new UsageError('--from must be LAT,LNG')
      return writeRoute(name, stretches, {
        ...(from ? { lat: from[0], lng: from[1] } : {}),
        ...(values.bearing !== undefined ? { bearing: num(values.bearing, 'bearing') } : {}),
        ...(values.ele !== undefined ? { ele: num(values.ele, 'ele') } : {}),
      })
    }
    case 'import-gpx': {
      const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { difficulty: { type: 'string', default: 'Easy' } } })
      return importGpx(exactly(positionals, 1, 'import-gpx <file>')[0], values.difficulty)
    }
    case 'save-activity': {
      const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { effort: { type: 'string', default: 'Easy' } } })
      return saveActivity(exactly(positionals, 1, 'save-activity <name>')[0], values.effort)
    }
    case 'shot': return shot(exactly(args, 1, 'shot <name>')[0])
    case 'crop': {
      const [ref, label] = exactly(args, 2, 'crop <shot> <label>')
      return crop(ref, label)
    }
    case 'tap': {
      const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { hold: { type: 'string' } } })
      return tap(exactly(positionals, 1, 'tap <label>')[0], num(values.hold, 'hold'))
    }
    case 'wait-for': {
      const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        options: { gone: { type: 'boolean', default: false }, timeout: { type: 'string', default: '20' } },
      })
      return waitFor(exactly(positionals, 1, 'wait-for <label>')[0], values.gone, num(values.timeout, 'timeout') ?? 20)
    }
    case 'build-has': {
      if (!(await buildHas(exactly(args, 1, 'build-has <string>')[0]))) process.exitCode = 1
      return
    }
    default: throw new UsageError(command ? `unknown command "${command}"` : 'no command')
  }
}

function reportPhoneGone(error: PhoneGone): void {
  const id = lastSerial()
  const walk = id ? readMemory(id).walk : null
  const where = walk
    ? `the walk reached ${Math.round(walk.mark)} m and the phone may still stand on the mock there`
    : 'if a walk ran, the phone may still be on the mock'
  console.error(`${error.message}; ${where} (\`walk stop\` once it is back)`)
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n\n${USAGE}`)
    process.exitCode = EXIT.usage
  } else if (error instanceof PhoneGone) {
    reportPhoneGone(error)
    process.exitCode = EXIT.phoneGone
  } else {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
})
