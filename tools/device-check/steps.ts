import { parseCommand, STEPS, UsageError, type Command } from './commandLine'

export interface Step { text: string; command: Command }

const OWN_GUARDS = 'a flow with guards of its own: run it on its own'
export const REFUSED: Record<string, string> = {
  walk: 'a move is a long wait: run it on its own, in the background, so the harness reports its end',
  'build-has': 'it pulls the installed bundle, a long wait: run it on its own, in the background',
  'import-gpx': OWN_GUARDS,
  'save-activity': OWN_GUARDS,
  delete: OWN_GUARDS,
  cleanup: OWN_GUARDS,
  route: 'it writes a file and touches no phone: run it on its own',
  'native-errors': 'its finding is its exit code, not a failure: run it on its own',
  do: 'a step list cannot hold another list',
}

function parseStep(text: string): Command {
  const words = splitWords(text)
  const [name] = words
  if (name === undefined) throw new UsageError('it is empty')
  if (REFUSED[name] !== undefined) throw new UsageError(`${name} is not a step: ${REFUSED[name]}`)
  if (!STEPS.includes(name)) throw new UsageError(`unknown command "${name}"`)
  return parseCommand(words)
}

// One step's command line split into its arguments as a POSIX shell splits words: blanks separate,
// single quotes keep everything, double quotes keep everything but `\"` and `\\`, a backslash
// outside quotes keeps the next character.
function splitWords(text: string): string[] {
  const words: string[] = []
  let word: string | null = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      if (word !== null) words.push(word)
      word = null
      continue
    }
    word ??= ''
    if (ch === "'") {
      const end = text.indexOf("'", i + 1)
      if (end === -1) throw new UsageError('a single quote is not closed')
      word += text.slice(i + 1, end)
      i = end
    } else if (ch === '"') {
      let j = i + 1
      for (; j < text.length && text[j] !== '"'; j++) {
        if (text[j] === '\\' && (text[j + 1] === '"' || text[j + 1] === '\\')) j++
        word += text[j]
      }
      if (j >= text.length) throw new UsageError('a double quote is not closed')
      i = j
    } else if (ch === '\\') {
      if (i + 1 >= text.length) throw new UsageError('a backslash ends the step')
      word += text[++i]
    } else {
      word += ch
    }
  }
  if (word !== null) words.push(word)
  return words
}

// Every step of a `do` list read before the first runs; a step that cannot run stops the list,
// named by its place in it.
export function parseSteps(texts: string[]): Step[] {
  if (texts.length === 0) throw new UsageError('do needs at least one step')
  return texts.map((text, i) => {
    try {
      return { text, command: parseStep(text) }
    } catch (error) {
      if (!(error instanceof UsageError)) throw error
      throw new UsageError(`step ${i + 1} (${text}): ${error.message}`)
    }
  })
}

export interface StepRunner {
  run(command: Command): Promise<string | undefined>
  print(text: string): void
  // Reports a failed step as the command line reports a failed command, and gives its exit code.
  failed(error: unknown): number
}

// Runs the steps in order, each under a header naming it; the first failure ends the list with
// that step's exit code.
export async function runSteps(steps: Step[], runner: StepRunner): Promise<number> {
  for (const [i, step] of steps.entries()) {
    runner.print(`[${i + 1}/${steps.length}] ${step.text}`)
    try {
      const output = await runner.run(step.command)
      if (output !== undefined) runner.print(output)
    } catch (error) {
      const code = runner.failed(error)
      const left = steps.length - i - 1
      runner.print(`step ${i + 1} of ${steps.length} failed (exit ${code}): ${left} step${left === 1 ? '' : 's'} not run`)
      return code
    }
  }
  return 0
}
