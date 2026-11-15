import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { USAGE } from '../commandLine'

// A command signature, `walk to <mark|end> --pace ... [--route FILE]`, read as the command it names
// (its leading words) and the options it lists.
function signature(text: string): [string, string] {
  const words = text.trim().split(/\s+/)
  const end = words.findIndex((w) => !/^[a-z][a-z-]*$/.test(w))
  const name = (end === -1 ? words : words.slice(0, end)).join(' ')
  const options = [...new Set(text.match(/--[a-z][a-z-]*/g) ?? [])].sort().join(' ')
  return [name, options]
}

const usageCommands = () =>
  new Map(
    USAGE.split('\n')
      .filter((line) => /^ {2}[a-z]/.test(line))
      .map((line) => signature(line.trim().split(/\s{2,}/)[0])),
  )

// The first cell of each row of the skill's command table, which may hold several signatures.
function skillCommands(): Map<string, string> {
  const skill = readFileSync(join(__dirname, '..', '..', '..', '.claude', 'skills', 'device-check', 'SKILL.md'), 'utf8')
  const table = skill.slice(skill.indexOf('## The toolkit')).split('\n\n').find((block) => block.startsWith('| Command |'))
  if (!table) throw new Error('no command table under "## The toolkit"')
  const rows = table.split('\n').slice(2)
  const cells = rows.map((row) => row.replace(/\\\|/g, '\u0000').split('|')[1].replace(/\u0000/g, '|'))
  return new Map(cells.flatMap((cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => signature(m[1]))))
}

describe("the toolkit's usage text and the skill's command table", () => {
  it('list the same commands with the same options', () => {
    expect(Object.fromEntries(skillCommands())).toEqual(Object.fromEntries(usageCommands()))
  })
})
