import * as path from 'node:path'
import {
  checkEnums,
  checkHeading,
  checkKeys,
  checkLinks,
  collectMarkdownFiles,
  readFrontmatter,
  type ItemFile,
  type ItemViolation,
} from './markdownItems'

export type TicketFile = ItemFile
export type TicketViolation = ItemViolation

const AREAS = ['map', 'recording', 'trails', 'activities', 'elevation', 'offline', 'settings', 'app-shell']

const TICKET_LIKE = /^T-/
const FILE_NAME = /^(T-\d+)-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// `wontfix` is absent on purpose: a ruled-out item is deleted.
const ENUMS = {
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
  return collectMarkdownFiles(dir, rootDir)
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
    } else if (!AREAS.includes(segments[0])) {
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

    const parsed = readFrontmatter(file.content, report)
    if (!parsed) continue
    const { fields, body } = parsed
    checkKeys(fields, KEYS, report)
    checkEnums(fields, ENUMS, report)
    if (fields.category === 'idea' && fields.triage != null) {
      report('an idea is not triaged: either empty its triage or promote its category')
    }
    if ('filed' in fields && !(typeof fields.filed === 'string' && isCalendarDate(fields.filed))) {
      report(`filed is ${JSON.stringify(fields.filed)}, expected a YYYY-MM-DD date`)
    }
    if ('from' in fields && fields.from != null && !(typeof fields.from === 'string' && fields.from.trim())) {
      report('from is either empty or a non-empty string')
    }
    checkLinks(fields, 'blocked_by', known, 'an open ticket', report)
    if (id) checkHeading(body, id, report)
  }
  return violations
}
