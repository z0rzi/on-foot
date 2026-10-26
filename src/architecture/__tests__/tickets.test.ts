/**
 * @jest-environment node
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { collectTicketFiles, findTicketViolations, type TicketFile } from '../tickets'

const frontmatter = (overrides: Record<string, string> = {}) => {
  const fields: Record<string, string> = {
    severity: 'minor',
    category: 'bug',
    size: 'S',
    triage: 'ready-for-agent',
    source: '"[[2026-09-10-full-review]]"',
    blocked_by: '[]',
    ...overrides,
  }
  return Object.entries(fields)
    .map(([key, value]) => (value === '' ? `${key}:` : `${key}: ${value}`))
    .join('\n')
}

const ticket = (
  name = 'ERR-7-dangling-link.md',
  fields: Record<string, string> = {},
  heading = `# ${name.split('-').slice(0, 2).join('-')}: a title`,
): TicketFile => ({ name, content: `---\n${frontmatter(fields)}\n---\n${heading}\n\nBody.\n` })

const problems = (files: TicketFile[]) => findTicketViolations(files).map((v) => v.problem)

describe('worklist ticket conventions', () => {
  test('every ticket in docs/reviews/open-work follows the conventions', () => {
    const violations = findTicketViolations(collectTicketFiles())
    const report = violations.map((v) => `  ${v.file}: ${v.problem}`).join('\n')
    expect(
      violations.length === 0 ? '' : `\nTicket violations (see docs/agents/issue-tracker.md):\n${report}\n`,
    ).toBe('')
  })

  test('accepts a well-formed ticket', () => {
    expect(findTicketViolations([ticket()])).toEqual([])
  })

  test('accepts empty severity, size and triage', () => {
    expect(problems([ticket(undefined, { severity: '', size: '', triage: '' })])).toEqual([])
  })

  test('accepts an empty folder', () => {
    expect(findTicketViolations([])).toEqual([])
  })

  test.each([
    'tickets.md',
    'ERR-7.md',
    'BUG-1-something.md',
    'ERR-x-something.md',
    'ERR-7-Has_Caps.md',
  ])('flags the file name %s', (name) => {
    expect(problems([ticket(name, {}, '# ERR-7: a title')])).toContainEqual(
      expect.stringContaining('file name'),
    )
  })

  test('flags two files sharing an ID', () => {
    const files = [ticket('ERR-7-one.md'), ticket('ERR-7-two.md')]
    expect(problems(files).filter((p) => p.includes('ERR-7'))).toHaveLength(1)
  })

  test('flags a file with no frontmatter', () => {
    expect(problems([{ name: 'ERR-7-x.md', content: '# ERR-7: a title\n' }])).toContainEqual(
      expect.stringContaining('frontmatter'),
    )
  })

  test('reports malformed YAML instead of throwing, and still checks the other files', () => {
    const broken = { name: 'ERR-7-x.md', content: '---\nseverity: [unclosed\n---\n# ERR-7: t\n' }
    const violations = findTicketViolations([broken, ticket('ERR-8-y.md', { category: 'chore' })])
    expect(violations.map((v) => v.file)).toEqual(['ERR-7-x.md', 'ERR-8-y.md'])
  })

  test('flags an unknown key, as when Obsidian adds a property', () => {
    const file = ticket()
    file.content = file.content.replace('blocked_by: []', 'blocked_by: []\ntags: []')
    expect(problems([file])).toContainEqual(expect.stringContaining('tags'))
  })

  test('flags a missing key', () => {
    const file = ticket()
    file.content = file.content.replace('size: S\n', '')
    expect(problems([file])).toContainEqual(expect.stringContaining('size'))
  })

  test.each([
    ['severity', 'critical'],
    ['category', 'chore'],
    ['category', ''],
    ['size', 'XL'],
    ['triage', 'wontfix'],
    ['triage', 'done'],
    ['source', ''],
    ['blocked_by', '"[[ERR-3-x]]"'],
  ])('flags %s: %s', (key, value) => {
    expect(problems([ticket(undefined, { [key]: value })])).toContainEqual(expect.stringContaining(key))
  })

  test('accepts blocked_by links to tickets in the folder', () => {
    const files = [ticket('ERR-7-a.md', { blocked_by: '["[[ERR-8-b]]"]' }), ticket('ERR-8-b.md')]
    expect(findTicketViolations(files)).toEqual([])
  })

  test('accepts a block-style blocked_by list, as Obsidian writes it', () => {
    const files = [ticket('ERR-7-a.md', { blocked_by: '\n  - "[[ERR-8-b]]"' }), ticket('ERR-8-b.md')]
    expect(findTicketViolations(files)).toEqual([])
  })

  test('flags a blocked_by link to a ticket that does not exist', () => {
    const files = [ticket('ERR-7-a.md', { blocked_by: '["[[ERR-3-closed]]"]' })]
    expect(problems(files)).toContainEqual(expect.stringContaining('ERR-3-closed'))
  })

  test('flags a blocked_by entry that is not a wikilink', () => {
    const files = [ticket('ERR-7-a.md', { blocked_by: '["ERR-8-b"]' }), ticket('ERR-8-b.md')]
    expect(problems(files)).toContainEqual(expect.stringContaining('blocked_by'))
  })

  test('flags a heading that does not start with the ID', () => {
    expect(problems([ticket('ERR-7-a.md', {}, '# ERR-8: wrong id')])).toContainEqual(
      expect.stringContaining('heading'),
    )
  })

  test('flags a ticket with no heading', () => {
    expect(problems([ticket('ERR-7-a.md', {}, 'No heading here.')])).toContainEqual(
      expect.stringContaining('heading'),
    )
  })
})

describe('collectTicketFiles', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickets-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  test('reads the .md files and ignores the rest', () => {
    fs.mkdirSync(path.join(dir, 'open-work'))
    fs.writeFileSync(path.join(dir, 'open-work', 'ERR-7-a.md'), 'x')
    fs.writeFileSync(path.join(dir, 'open-work', 'notes.txt'), 'x')
    expect(collectTicketFiles('open-work', dir)).toEqual([{ name: 'ERR-7-a.md', content: 'x' }])
  })

  test('throws when the folder is missing', () => {
    expect(() => collectTicketFiles('open-work', dir)).toThrow(/open-work/)
  })
})
