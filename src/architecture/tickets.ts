import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse } from 'yaml'

export interface TicketFile {
  name: string
  content: string
}

export interface TicketViolation {
  file: string
  problem: string
}

const PREFIXES = ['FIELD', 'ERR', 'ARCH', 'DEAD', 'DOC', 'DUP', 'TEST', 'PERF', 'PROP']
const FILE_NAME = new RegExp(`^((?:${PREFIXES.join('|')})-\\d+)-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`)
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/
const WIKILINK = /^\[\[([^\]]+)\]\]$/

// `null` admits an empty value. `wontfix` is absent on purpose: a ruled-out item is deleted.
const ENUMS: Record<string, (string | null)[]> = {
  severity: ['should-fix', 'minor', 'investigate', null],
  category: ['bug', 'enhancement'],
  size: ['S', 'M', 'L', null],
  triage: ['needs-triage', 'needs-info', 'ready-for-agent', 'ready-for-human', null],
}
const KEYS = [...Object.keys(ENUMS), 'source', 'blocked_by']

export function collectTicketFiles(
  dir: string = 'docs/reviews/open-work',
  rootDir: string = process.cwd(),
): TicketFile[] {
  const abs = path.join(rootDir, dir)
  if (!fs.existsSync(abs)) throw new Error(`worklist folder ${dir} is missing`)
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => ({ name: entry.name, content: fs.readFileSync(path.join(abs, entry.name), 'utf8') }))
}

export function findTicketViolations(files: TicketFile[]): TicketViolation[] {
  const violations: TicketViolation[] = []
  const known = new Set(files.map((f) => f.name.replace(/\.md$/, '')))
  const seenIds = new Map<string, string>()

  for (const file of files) {
    const report = (problem: string) => violations.push({ file: file.name, problem })

    const id = FILE_NAME.exec(file.name)?.[1]
    if (!id) {
      report(`file name must be <PREFIX>-<n>-<kebab-slug>.md, PREFIX one of ${PREFIXES.join(', ')}`)
    } else if (seenIds.has(id)) {
      report(`ID ${id} is already used by ${seenIds.get(id)}`)
    } else {
      seenIds.set(id, file.name)
    }

    const fm = FRONTMATTER.exec(file.content)
    if (!fm) {
      report('no frontmatter block')
      continue
    }
    let data: unknown
    try {
      data = parse(fm[1])
    } catch (err) {
      report(`frontmatter is not valid YAML: ${err instanceof Error ? err.message.split('\n')[0] : err}`)
      continue
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      report('frontmatter is not a key/value map')
      continue
    }
    const fields = data as Record<string, unknown>

    for (const key of Object.keys(fields)) {
      if (!KEYS.includes(key)) report(`unknown frontmatter key ${key}`)
    }
    for (const key of KEYS) {
      if (!(key in fields)) report(`missing frontmatter key ${key}`)
    }
    for (const [key, allowed] of Object.entries(ENUMS)) {
      if (key in fields && !allowed.includes(fields[key] as string | null)) {
        const shown = allowed.map((v) => v ?? '(empty)').join(' | ')
        report(`${key} is ${JSON.stringify(fields[key])}, expected ${shown}`)
      }
    }
    if ('source' in fields && (typeof fields.source !== 'string' || fields.source.trim() === '')) {
      report('source must be a non-empty string')
    }
    if ('blocked_by' in fields) {
      const blockers = fields.blocked_by
      if (!Array.isArray(blockers)) {
        report('blocked_by must be a list')
      } else {
        for (const entry of blockers) {
          const target = typeof entry === 'string' ? WIKILINK.exec(entry)?.[1] : undefined
          if (!target) report(`blocked_by entry ${JSON.stringify(entry)} is not a [[wikilink]]`)
          else if (!known.has(target)) report(`blocked_by links [[${target}]], which is not an open ticket`)
        }
      }
    }

    const heading = /^# (.*)$/m.exec(file.content.slice(fm[0].length))?.[1]
    if (id && !heading?.startsWith(`${id}: `)) report(`first heading must start with "# ${id}: "`)
  }
  return violations
}
