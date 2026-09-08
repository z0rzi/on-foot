import { DUPLICATION_EXEMPT, DUPLICATION_WINDOW, findDuplicateBlocks, significantLines } from '../duplication'
import { collectSourceFiles } from '../sourceScan'

const block = (n: number, line: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => line(i)).join('\n')

const tenLines = block(10, (i) => `const value${i} = compute(${i}, input)`)

describe('verbatim duplication', () => {
  test('the source tree has no verbatim block of DUPLICATION_WINDOW significant lines or more', () => {
    const blocks = findDuplicateBlocks(collectSourceFiles(), DUPLICATION_WINDOW, DUPLICATION_EXEMPT)
    const report = blocks
      .map(
        (b) =>
          `  ${b.a.file}:${b.a.startLine}-${b.a.endLine} <-> ${b.b.file}:${b.b.startLine}-${b.b.endLine} (${b.lines} significant lines)`,
      )
      .join('\n')
    expect(blocks.length === 0 ? '' : `\nVerbatim duplicates (extract the shared shape or register an exemption):\n${report}\n`).toBe('')
  })

  test('reports two files that share a verbatim block', () => {
    const files = [
      { path: 'src/a.ts', content: tenLines },
      { path: 'src/b.ts', content: tenLines },
    ]
    const blocks = findDuplicateBlocks(files, 8, [])
    expect(blocks).toEqual([
      { a: { file: 'src/a.ts', startLine: 1, endLine: 10 }, b: { file: 'src/b.ts', startLine: 1, endLine: 10 }, lines: 10 },
    ])
  })

  test('ignores a shared block shorter than the window', () => {
    const seven = block(7, (i) => `const value${i} = compute(${i}, input)`)
    const files = [
      { path: 'src/a.ts', content: seven },
      { path: 'src/b.ts', content: seven },
    ]
    expect(findDuplicateBlocks(files, 8, [])).toHaveLength(0)
  })

  test('blank lines, comments, imports and punctuation-only lines do not count', () => {
    const padding = [
      "import { x } from './x'",
      "export { y } from './y'",
      '',
      '// a comment',
      '/* block',
      ' * comment */',
      '{',
      '}',
      '),',
      '];',
    ].join('\n')
    const files = [
      { path: 'src/a.ts', content: `${padding}\nconst one = 1\nconst two = 2` },
      { path: 'src/b.ts', content: `${padding}\nconst one = 1\nconst two = 2` },
    ]
    expect(significantLines(files[0].content)).toEqual([
      { line: 11, text: 'const one = 1' },
      { line: 12, text: 'const two = 2' },
    ])
    expect(findDuplicateBlocks(files, 2, [])).toHaveLength(1)
    expect(findDuplicateBlocks(files, 3, [])).toHaveLength(0)
  })

  test('reports a block repeated within one file, but never a window against itself', () => {
    const files = [{ path: 'src/a.ts', content: `${tenLines}\nconst gap = 0\n${tenLines}` }]
    const blocks = findDuplicateBlocks(files, 8, [])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ a: { startLine: 1, endLine: 10 }, b: { startLine: 12, endLine: 21 }, lines: 10 })
  })

  test('honours an exemption prefix', () => {
    const files = [
      { path: 'src/assets/icons/a.tsx', content: tenLines },
      { path: 'src/assets/icons/b.tsx', content: tenLines },
    ]
    expect(findDuplicateBlocks(files, 8, [{ path: 'src/assets/icons/', rationale: 'test' }])).toHaveLength(0)
    expect(findDuplicateBlocks(files, 8, [])).toHaveLength(1)
  })

  test('cannot see a copy that renames its identifiers (that is the spec sibling step, not this gate)', () => {
    const files = [
      { path: 'src/trail.ts', content: block(10, (i) => `const trail${i} = loadTrail(${i})`) },
      { path: 'src/activity.ts', content: block(10, (i) => `const activity${i} = loadActivity(${i})`) },
    ]
    expect(findDuplicateBlocks(files, 8, [])).toHaveLength(0)
  })
})
