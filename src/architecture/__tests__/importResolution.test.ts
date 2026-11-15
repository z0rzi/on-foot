import { importSpecifiers, resolvedImportGraph, runtimeImportSpecifiers } from '../importResolution'

const files = [
  {
    path: 'src/a.ts',
    content: "import type { T } from './types'\nimport React from 'react'\nimport { b } from '@/feature'\nimport './missing'",
  },
  { path: 'src/types.ts', content: '' },
  { path: 'src/feature/index.ts', content: "import { a } from '../a'" },
]

describe('the resolved import graph', () => {
  test('lists the imports of every file in source order, a source file as its path, anything else unresolved', () => {
    expect(resolvedImportGraph(files, importSpecifiers).get('src/a.ts')).toEqual([
      { spec: './types', target: 'src/types.ts' },
      { spec: 'react', target: null },
      { spec: '@/feature', target: 'src/feature/index.ts' },
      { spec: './missing', target: null },
    ])
    expect(resolvedImportGraph(files, importSpecifiers).get('src/feature/index.ts')).toEqual([
      { spec: '../a', target: 'src/a.ts' },
    ])
  })

  test('reads the specifiers it is given, so a runtime graph leaves out type-only imports', () => {
    expect(resolvedImportGraph(files, runtimeImportSpecifiers).get('src/a.ts')?.map((i) => i.spec)).toEqual([
      'react',
      '@/feature',
      './missing',
    ])
  })
})
