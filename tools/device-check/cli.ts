import { lastSerial, PhoneGone, serial } from './adb'
import { parseCommand, runCommand, startsTheRecorder, USAGE, UsageError, type Command } from './commandLine'
import { errorMessage } from './errorMessage'
import { ensureRecorder } from './recorder'
import { allowedForeground } from './screen'
import { parseSteps, runSteps } from './steps'
import { readMemory } from './phoneStore'

const EXIT = { usage: 2, phoneGone: 3 }

async function execute(command: Command): Promise<string | undefined> {
  if (startsTheRecorder(command)) await ensureRecorder(await serial())
  return runCommand(command)
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
