import { SEAMS, findSeamViolations } from '../seams'
import { collectSourceFiles } from '../sourceScan'

describe('architecture seams', () => {
  test('no source file imports a seam token outside its allowed boundary', () => {
    const violations = findSeamViolations(collectSourceFiles(), SEAMS)
    const report = violations
      .map((v) => `  ${v.file} imports "${v.token}" (${v.seam} seam)\n    -> ${v.rationale}`)
      .join('\n')
    expect(violations.length === 0 ? '' : `\nSeam violations:\n${report}\n`).toBe('')
  })

  test('flags a forbidden import outside the boundary', () => {
    const files = [{ path: 'src/store/mapStore.ts', content: "import Mapbox from '@rnmapbox/maps'" }]
    expect(findSeamViolations(files)).toHaveLength(1)
  })

  test('allows the same import inside the boundary', () => {
    const files = [
      { path: 'src/map/providers/mapbox/adapter.tsx', content: "import Mapbox from '@rnmapbox/maps'" },
    ]
    expect(findSeamViolations(files)).toHaveLength(0)
  })

  test('matches subpath imports like drizzle-orm/expo-sqlite', () => {
    const files = [{ path: 'src/store/x.ts', content: "import { drizzle } from 'drizzle-orm/expo-sqlite'" }]
    expect(findSeamViolations(files).some((v) => v.token === 'drizzle-orm')).toBe(true)
  })

  test('matches side-effect imports', () => {
    const files = [{ path: 'src/store/x.ts', content: "import '@rnmapbox/maps'" }]
    expect(findSeamViolations(files)).toHaveLength(1)
  })

  test('ignores tokens appearing only in comments or string constants', () => {
    const files = [
      { path: 'src/store/x.ts', content: "// wraps @rnmapbox/maps\nexport const name = 'drizzle-orm'" },
    ]
    expect(findSeamViolations(files)).toHaveLength(0)
  })
})
