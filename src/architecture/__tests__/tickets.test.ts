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
    origin: 'agent',
    filed: '2026-11-02',
    from: '"[[2026-09-10-full-review]]"',
    blocked_by: '[]',
    ...overrides,
  }
  return Object.entries(fields)
    .map(([key, value]) => (value === '' ? `${key}:` : `${key}: ${value}`))
    .join('\n')
}

const idOf = (file: string) => path.basename(file).split('-').slice(0, 2).join('-')

const ticket = (
  file = 'map/T-7-dangling-link.md',
  fields: Record<string, string> = {},
  heading = `# ${idOf(file)}: a title`,
): TicketFile => ({ path: file, content: `---\n${frontmatter(fields)}\n---\n${heading}\n\nBody.\n` })

const problems = (files: TicketFile[]) => findTicketViolations(files).map((v) => v.problem)

describe('worklist ticket conventions', () => {
  test('every ticket in docs/tickets follows the conventions', () => {
    const violations = findTicketViolations(collectTicketFiles())
    const report = violations.map((v) => `  ${v.file}: ${v.problem}`).join('\n')
    expect(
      violations.length === 0 ? '' : `\nTicket violations (see docs/agents/issue-tracker.md):\n${report}\n`,
    ).toBe('')
  })

  test('accepts a well-formed ticket', () => {
    expect(findTicketViolations([ticket()])).toEqual([])
  })

  test('accepts empty severity, size, triage and from', () => {
    expect(problems([ticket(undefined, { severity: '', size: '', triage: '', from: '' })])).toEqual([])
  })

  test('accepts an empty folder', () => {
    expect(findTicketViolations([])).toEqual([])
  })

  test('accepts every declared area', () => {
    const areas = ['map', 'recording', 'trails', 'activities', 'elevation', 'offline', 'settings', 'app-shell']
    expect(findTicketViolations(areas.map((area, n) => ticket(`${area}/T-${n}-x.md`)))).toEqual([])
  })

  test('ignores a non-ticket file at the root, such as the README', () => {
    expect(findTicketViolations([{ path: 'README.md', content: '# Tickets\n' }])).toEqual([])
  })

  test('flags a ticket left at the root', () => {
    expect(problems([ticket('T-7-x.md')])).toContainEqual(expect.stringContaining('area'))
  })

  test('flags a ticket in an unknown area', () => {
    expect(problems([ticket('kitchen/T-7-x.md')])).toContainEqual(expect.stringContaining('kitchen'))
  })

  test('flags a ticket nested below an area', () => {
    expect(problems([ticket('map/sub/T-7-x.md')])).toContainEqual(expect.stringContaining('area'))
  })

  test.each(['tickets.md', 'T-7.md', 'ERR-7-something.md', 'T-x-something.md', 'T-7-Has_Caps.md', '7-slug.md'])(
    'flags the file name %s',
    (name) => {
      expect(problems([ticket(`map/${name}`, {}, '# T-7: a title')])).toContainEqual(
        expect.stringContaining('file name'),
      )
    },
  )

  test('flags two files sharing an ID, even across areas', () => {
    const files = [ticket('map/T-7-one.md'), ticket('trails/T-7-two.md')]
    expect(problems(files).filter((p) => p.includes('T-7'))).toHaveLength(1)
  })

  test('flags a file with no frontmatter', () => {
    expect(problems([{ path: 'map/T-7-x.md', content: '# T-7: a title\n' }])).toContainEqual(
      expect.stringContaining('frontmatter'),
    )
  })

  test('reports malformed YAML instead of throwing, and still checks the other files', () => {
    const broken = { path: 'map/T-7-x.md', content: '---\nseverity: [unclosed\n---\n# T-7: t\n' }
    const violations = findTicketViolations([broken, ticket('map/T-8-y.md', { category: 'chore' })])
    expect(violations.map((v) => v.file)).toEqual(['map/T-7-x.md', 'map/T-8-y.md'])
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
    ['origin', 'review'],
    ['origin', ''],
    ['filed', ''],
    ['filed', '02/11/2026'],
    ['filed', '2026-13-40'],
    ['filed', '"2026-11-02T10:00"'],
    ['from', '""'],
    ['blocked_by', '"[[T-3-x]]"'],
  ])('flags %s: %s', (key, value) => {
    expect(problems([ticket(undefined, { [key]: value })])).toContainEqual(expect.stringContaining(key))
  })

  test.each(['bug', 'enhancement', 'refactor', 'docs', 'tests'])('accepts category %s', (category) => {
    expect(problems([ticket(undefined, { category })])).toEqual([])
  })

  test('accepts an idea with no triage', () => {
    expect(problems([ticket(undefined, { category: 'idea', triage: '', severity: '', size: '' })])).toEqual([])
  })

  test('flags an idea that carries a triage role', () => {
    expect(problems([ticket(undefined, { category: 'idea', triage: 'needs-triage' })])).toContainEqual(
      expect.stringContaining('idea'),
    )
  })

  test('accepts blocked_by links to tickets anywhere in the tree', () => {
    const files = [ticket('map/T-7-a.md', { blocked_by: '["[[T-8-b]]"]' }), ticket('trails/T-8-b.md')]
    expect(findTicketViolations(files)).toEqual([])
  })

  test('accepts a block-style blocked_by list, as Obsidian writes it', () => {
    const files = [ticket('map/T-7-a.md', { blocked_by: '\n  - "[[T-8-b]]"' }), ticket('map/T-8-b.md')]
    expect(findTicketViolations(files)).toEqual([])
  })

  test('flags a blocked_by link to a ticket that does not exist', () => {
    const files = [ticket('map/T-7-a.md', { blocked_by: '["[[T-3-closed]]"]' })]
    expect(problems(files)).toContainEqual(expect.stringContaining('T-3-closed'))
  })

  test('flags a blocked_by entry that is not a wikilink', () => {
    const files = [ticket('map/T-7-a.md', { blocked_by: '["T-8-b"]' }), ticket('map/T-8-b.md')]
    expect(problems(files)).toContainEqual(expect.stringContaining('blocked_by'))
  })

  test('flags a heading that does not start with the ID', () => {
    expect(problems([ticket('map/T-7-a.md', {}, '# T-8: wrong id')])).toContainEqual(
      expect.stringContaining('heading'),
    )
  })

  test('flags a ticket with no heading', () => {
    expect(problems([ticket('map/T-7-a.md', {}, 'No heading here.')])).toContainEqual(
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

  test('reads the .md files at the root and in subfolders, ignores the rest', () => {
    fs.mkdirSync(path.join(dir, 'tickets', 'map'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'tickets', 'README.md'), 'r')
    fs.writeFileSync(path.join(dir, 'tickets', 'tickets.base'), 'b')
    fs.writeFileSync(path.join(dir, 'tickets', 'map', 'T-7-a.md'), 'x')
    fs.writeFileSync(path.join(dir, 'tickets', 'map', 'notes.txt'), 'x')
    expect(collectTicketFiles('tickets', dir)).toEqual([
      { path: 'README.md', content: 'r' },
      { path: 'map/T-7-a.md', content: 'x' },
    ])
  })

  test('throws when the folder is missing', () => {
    expect(() => collectTicketFiles('tickets', dir)).toThrow(/tickets/)
  })
})
