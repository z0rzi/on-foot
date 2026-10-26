import { SEAMS, findSeamViolations } from '../seams'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
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

  test('flags the location SDK outside src/location', () => {
    const files = [{ path: 'src/recording/recordingController.ts', content: "import * as Location from 'expo-location'" }]
    expect(findSeamViolations(files).some((v) => v.seam === 'location')).toBe(true)
  })

  test('flags the linking SDK outside src/external', () => {
    const files = [{ path: 'src/trails/TrailInfoSheet.tsx', content: "import { openURL } from 'expo-linking'" }]
    expect(findSeamViolations(files).some((v) => v.seam === 'external-apps')).toBe(true)
  })

  test('flags the native-module API outside modules/share-intent', () => {
    const files = [{ path: 'src/trails/useIncomingShare.ts', content: "import { requireNativeModule } from 'expo-modules-core'" }]
    expect(findSeamViolations(files).some((v) => v.seam === 'native-modules')).toBe(true)
  })

  test('scans the local modules tree, skipping build outputs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seams-'))
    const write = (rel: string) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
      fs.writeFileSync(path.join(root, rel), '')
    }
    write('modules/share-intent/index.ts')
    write('modules/share-intent/build/index.d.ts')
    const paths = collectSourceFiles(undefined, root).map((f) => f.path)
    fs.rmSync(root, { recursive: true, force: true })
    expect(paths).toEqual(['modules/share-intent/index.ts'])
  })
})
