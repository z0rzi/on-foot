import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse } from 'yaml'

export interface TicketFile {
  /** Path relative to the tickets folder, e.g. `map/T-4-progressive-route-rendering.md`. */
  path: string
  content: string
}

export interface TicketViolation {
  file: string
  problem: string
}

export const AREAS = [
  'map',
  'recording',
  'trails',
  'activities',
  'elevation',
  'offline',
  'settings',
  'app-shell',
] as const

const TICKET_LIKE = /^T-/
const FILE_NAME = /^(T-\d+)-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/
const WIKILINK = /^\[\[([^\]]+)\]\]$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// `null` admits an empty value. `wontfix` is absent on purpose: a ruled-out item is deleted.
const ENUMS: Record<string, (string | null)[]> = {
  severity: ['should-fix', 'minor', 'investigate', null],
  category: ['bug', 'enhancement', 'refactor', 'docs', 'tests', 'idea'],
  size: ['S', 'M', 'L', null],
  triage: ['needs-triage', 'needs-info', 'ready-for-agent', 'ready-for-human', null],
  origin: ['owner', 'agent'],
}
const KEYS = ['severity', 'category', 'size', 'triage', 'origin', 'filed', 'from', 'blocked_by']

const isCalendarDate = (value: string) => {
  if (!ISO_DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

export function collectTicketFiles(dir: string = 'docs/tickets', rootDir: string = process.cwd()): TicketFile[] {
  const abs = path.join(rootDir, dir)
  if (!fs.existsSync(abs)) throw new Error(`tickets folder ${dir} is missing`)
  const files: TicketFile[] = []
  const walk = (sub: string) => {
    for (const entry of fs.readdirSync(path.join(abs, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(rel)
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push({ path: rel, content: fs.readFileSync(path.join(abs, rel), 'utf8') })
      }
    }
  }
  walk('')
  return files
}

export function findTicketViolations(files: TicketFile[]): TicketViolation[] {
  const violations: TicketViolation[] = []
  const tickets = files.filter((f) => f.path.includes('/') || TICKET_LIKE.test(f.path))
  const known = new Set(tickets.map((f) => path.basename(f.path, '.md')))
  const seenIds = new Map<string, string>()

  for (const file of tickets) {
    const report = (problem: string) => violations.push({ file: file.path, problem })
    const segments = file.path.split('/')
    const name = segments[segments.length - 1]

    if (segments.length !== 2) {
      report(`a ticket lives in exactly one area folder, one of ${AREAS.join(', ')}`)
    } else if (!(AREAS as readonly string[]).includes(segments[0])) {
      report(`unknown area ${segments[0]}, expected one of ${AREAS.join(', ')}`)
    }

    const id = FILE_NAME.exec(name)?.[1]
    if (!id) {
      report('file name must be T-<n>-<kebab-slug>.md')
    } else if (seenIds.has(id)) {
      report(`ID ${id} is already used by ${seenIds.get(id)}`)
    } else {
      seenIds.set(id, file.path)
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
    if (fields.category === 'idea' && fields.triage != null) {
      report('an idea is not triaged: either empty its triage or promote its category')
    }
    if ('filed' in fields && !(typeof fields.filed === 'string' && isCalendarDate(fields.filed))) {
      report(`filed is ${JSON.stringify(fields.filed)}, expected a YYYY-MM-DD date`)
    }
    if ('from' in fields && fields.from != null && !(typeof fields.from === 'string' && fields.from.trim())) {
      report('from is either empty or a non-empty string')
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
