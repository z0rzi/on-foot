import { findImportCycles } from '../importGraph'
import { collectSourceFiles } from '../sourceScan'

describe('import cycles', () => {
  test('the source graph has no circular imports', () => {
    const cycles = findImportCycles(collectSourceFiles())
    const report = cycles.map((c) => `  ${c.join(' -> ')}`).join('\n')
    expect(cycles.length === 0 ? '' : `\nCircular imports:\n${report}\n`).toBe('')
  })

  test('detects a direct cycle between two modules', () => {
    const files = [
      { path: 'src/a.ts', content: "import { b } from './b'" },
      { path: 'src/b.ts', content: "import { a } from './a'" },
    ]
    expect(findImportCycles(files)).toHaveLength(1)
  })

  test('resolves the @/ alias and index barrels', () => {
    const files = [
      { path: 'src/a.ts', content: "import { x } from '@/feature'" },
      { path: 'src/feature/index.ts', content: "import { a } from '../a'" },
    ]
    expect(findImportCycles(files)).toHaveLength(1)
  })

  test('ignores external packages and acyclic graphs', () => {
    const files = [
      { path: 'src/a.ts', content: "import React from 'react'\nimport { b } from './b'" },
      { path: 'src/b.ts', content: "import { drizzle } from 'drizzle-orm'" },
    ]
    expect(findImportCycles(files)).toHaveLength(0)
  })
})
