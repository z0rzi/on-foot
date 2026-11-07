/**
 * @jest-environment node
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { ItemFile } from '../markdownItems'
import { collectPlanFiles, findPlanViolations } from '../planItems'
import { collectTicketFiles } from '../tickets'

const frontmatter = (overrides: Record<string, string> = {}) => {
  const fields: Record<string, string> = { status: 'open', blocked_by: '[]', closes: '[]', ...overrides }
  return Object.entries(fields)
    .map(([key, value]) => (value === '' ? `${key}:` : `${key}: ${value}`))
    .join('\n')
}

const plan = (folder = '2026-11-06-hiking-ux'): ItemFile => ({
  path: `${folder}/plan.md`,
  content: '# Hiking UX\n\n| # | item |\n',
})

const item = (
  file = '2026-11-06-hiking-ux/01-status-pill.md',
  fields: Record<string, string> = {},
  heading = `# ${path.basename(file).slice(0, 2)}: a title`,
): ItemFile => ({ path: file, content: `---\n${frontmatter(fields)}\n---\n${heading}\n\nBody.\n` })

const OPEN_TICKETS = ['T-14-hiking-ux-without-nav-bar']
const problems = (files: ItemFile[], tickets = OPEN_TICKETS) =>
  findPlanViolations(files, tickets).map((v) => v.problem)

describe('plan work item conventions', () => {
  test('every plan folder in docs/design/plans follows the conventions', () => {
    const tickets = collectTicketFiles().map((f) => path.basename(f.path, '.md'))
    const violations = findPlanViolations(collectPlanFiles(), tickets)
    const report = violations.map((v) => `  ${v.file}: ${v.problem}`).join('\n')
    expect(
      violations.length === 0 ? '' : `\nPlan violations (see docs/agents/issue-tracker.md):\n${report}\n`,
    ).toBe('')
  })

  test('accepts a plan folder with its plan.md and well-formed items', () => {
    expect(findPlanViolations([plan(), item(), item('2026-11-06-hiking-ux/02-sheet.md')], [])).toEqual([])
  })

  test('accepts a built plan: plan.md alone', () => {
    expect(findPlanViolations([plan()], [])).toEqual([])
  })

  test('accepts no plan folders at all', () => {
    expect(findPlanViolations([], [])).toEqual([])
  })

  test('ignores the flat plans at the root', () => {
    expect(findPlanViolations([{ path: '2026-10-27-fix-gate.md', content: '# Plan\n' }], [])).toEqual([])
  })

  test('flags a plan folder with no plan.md', () => {
    expect(problems([item()])).toContainEqual(expect.stringContaining('plan.md'))
  })

  test('flags a file in a plan folder that is neither plan.md nor an item', () => {
    const violations = findPlanViolations([plan(), { path: '2026-11-06-hiking-ux/notes.md', content: 'x' }], [])
    expect(violations).toEqual([{ file: '2026-11-06-hiking-ux/notes.md', problem: expect.stringContaining('file name') }])
  })

  test.each(['1-x.md', '001-x.md', '01-Has_Caps.md', '01.md', 'T-7-x.md'])('flags the item name %s', (name) => {
    expect(problems([plan(), item(`2026-11-06-hiking-ux/${name}`, {}, '# 01: t')])).toContainEqual(
      expect.stringContaining('file name'),
    )
  })

  test('flags an item nested below its plan folder', () => {
    expect(problems([plan(), item('2026-11-06-hiking-ux/issues/01-x.md')])).toContainEqual(
      expect.stringContaining('plan folder'),
    )
  })

  test('flags two items sharing a number in one plan, not across plans', () => {
    const twice = [plan(), item('2026-11-06-hiking-ux/01-a.md'), item('2026-11-06-hiking-ux/01-b.md')]
    expect(problems(twice).filter((p) => p.includes('01'))).toHaveLength(1)
    const apart = [plan('a'), plan('b'), item('a/01-a.md'), item('b/01-b.md')]
    expect(findPlanViolations(apart, [])).toEqual([])
  })

  test('flags an item with no frontmatter', () => {
    expect(problems([plan(), { path: '2026-11-06-hiking-ux/01-x.md', content: '# 01: t\n' }])).toContainEqual(
      expect.stringContaining('frontmatter'),
    )
  })

  test('flags an unknown key and a missing key', () => {
    const extra = item()
    extra.content = extra.content.replace('closes: []', 'closes: []\ntriage: ready-for-agent')
    expect(problems([plan(), extra])).toContainEqual(expect.stringContaining('triage'))
    const missing = item()
    missing.content = missing.content.replace('closes: []\n', '')
    expect(problems([plan(), missing])).toContainEqual(expect.stringContaining('closes'))
  })

  test.each([
    ['status', ''],
    ['status', 'done'],
    ['status', 'ready-for-agent'],
    ['blocked_by', '"[[02-x]]"'],
    ['closes', '"T-14"'],
  ])('flags %s: %s', (key, value) => {
    expect(problems([plan(), item(undefined, { [key]: value })])).toContainEqual(expect.stringContaining(key))
  })

  test('accepts a claimed item', () => {
    expect(findPlanViolations([plan(), item(undefined, { status: 'claimed' })], [])).toEqual([])
  })

  test('accepts blocked_by links to items in the same plan', () => {
    const files = [plan(), item('2026-11-06-hiking-ux/01-a.md'), item('2026-11-06-hiking-ux/02-b.md', { blocked_by: '["[[01-a]]"]' })]
    expect(findPlanViolations(files, [])).toEqual([])
  })

  test('flags a blocked_by link to an item of another plan or none', () => {
    const files = [plan('a'), plan('b'), item('a/01-a.md'), item('b/01-b.md', { blocked_by: '["[[01-a]]"]' })]
    expect(problems(files)).toContainEqual(expect.stringContaining('01-a'))
  })

  test('accepts closes links to open tracker tickets', () => {
    const files = [plan(), item(undefined, { closes: '["[[T-14-hiking-ux-without-nav-bar]]"]' })]
    expect(findPlanViolations(files, OPEN_TICKETS)).toEqual([])
  })

  test('flags a closes link to a ticket that is not open', () => {
    const files = [plan(), item(undefined, { closes: '["[[T-3-gone]]"]' })]
    expect(problems(files)).toContainEqual(expect.stringContaining('T-3-gone'))
  })

  test('flags a heading that does not start with the number', () => {
    expect(problems([plan(), item(undefined, {}, '# 02: wrong')])).toContainEqual(expect.stringContaining('heading'))
  })
})

describe('collectPlanFiles', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plans-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  test('reads the .md files at the root and in plan folders, ignores the rest', () => {
    fs.mkdirSync(path.join(dir, 'plans', 'x'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'plans', 'flat.md'), 'f')
    fs.writeFileSync(path.join(dir, 'plans', 'plans.base'), 'b')
    fs.writeFileSync(path.join(dir, 'plans', 'x', 'plan.md'), 'p')
    fs.writeFileSync(path.join(dir, 'plans', 'x', '01-a.md'), 'i')
    expect(collectPlanFiles('plans', dir)).toEqual([
      { path: 'flat.md', content: 'f' },
      { path: 'x/01-a.md', content: 'i' },
      { path: 'x/plan.md', content: 'p' },
    ])
  })

  test('throws when the folder is missing', () => {
    expect(() => collectPlanFiles('plans', dir)).toThrow(/plans/)
  })
})
