import { lastSerial, PhoneGone } from './adb'
import { buildHas } from './buildHas'
import { parseCommand, USAGE, UsageError, type Command } from './commandLine'
import { cleanup, deleteItem } from './deleteFlow'
import { errorMessage } from './errorMessage'
import { importGpx, saveActivity } from './flows'
import { frames } from './frames'
import { back, typeText } from './keys'
import { crop, labels, scroll, shot, tap, waitFor } from './look'
import { writeRoute } from './routeFile'
import { walkJump, walkStatus, walkStop, walkTo } from './walk'
import { reportNativeErrors } from './nativeErrors'
import { allowedForeground } from './screen'
import { parseSteps, runSteps } from './steps'
import { readMemory } from './phoneStore'
import { zoom } from './zoom'

const EXIT = { usage: 2, phoneGone: 3 }

// The command's result, printed by the caller; a command that streams its progress prints that itself.
async function execute(command: Command): Promise<string | undefined> {
  switch (command.command) {
    case 'walk-to': return walkTo(command.mark, command.pace, command.options)
    case 'walk-jump': return walkJump(command.mark, command.options)
    case 'walk-status': return walkStatus()
    case 'walk-stop': return walkStop(command.force)
    case 'route': return writeRoute(command.name, command.stretches, command.start)
    case 'import-gpx': return importGpx(command.file, command.difficulty)
    case 'save-activity': return saveActivity(command.name, command.effort)
    case 'delete': return deleteItem(command.kind, command.name)
    case 'cleanup':
      if (!(await cleanup())) process.exitCode = 1
      return undefined
    case 'labels': return labels()
    case 'shot': return shot(command.name)
    case 'frames': return frames(command.name, command.count, command.everyMs)
    case 'crop': return crop(command.ref, command.label)
    case 'tap': return tap(command.label, command.options)
    case 'scroll': return scroll(command.direction)
    case 'back': return back()
    case 'type': return typeText(command.text)
    case 'zoom': return zoom(command.direction, command.at, command.steps)
    case 'wait-for': return waitFor(command.label, command.gone, command.timeoutS)
    case 'build-has': {
      const { found, report } = await buildHas(command.text)
      if (!found) process.exitCode = 1
      return report
    }
    case 'native-errors': {
      const { found, report } = await reportNativeErrors()
      if (found) process.exitCode = 1
      return report
    }
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

function reportFailure(error: unknown): number {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n\n${USAGE}`)
    return EXIT.usage
  }
  if (error instanceof PhoneGone) {
    reportPhoneGone(error)
    return EXIT.phoneGone
  }
  console.error(errorMessage(error))
  return 1
}

async function main(argv: string[]): Promise<void> {
  const [command, ...steps] = argv
  if (command === 'do') {
    process.exitCode = await runSteps(parseSteps(steps), {
      // Another app brought in front stops the list; a screen between two activities is left to
      // the step's own guard, which tap and wait-for wait through.
      run: async (step) => {
        await allowedForeground()
        return execute(step)
      },
      print: (text) => console.log(text),
      failed: reportFailure,
    })
    return
  }
  const result = await execute(parseCommand(argv))
  if (result !== undefined) console.log(result)
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.exitCode = reportFailure(error)
})
