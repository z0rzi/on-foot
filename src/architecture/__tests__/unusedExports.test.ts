import { collectSourceFiles } from '../sourceScan'
import { UNUSED_EXPORT_EXEMPT, findUnusedExports } from '../unusedExports'

describe('unused exports', () => {
  test('every export in the source tree has an importer outside its own file and the tests', () => {
    const unused = findUnusedExports(collectSourceFiles(), UNUSED_EXPORT_EXEMPT)
    const report = unused.map((u) => `  ${u.file} exports "${u.name}"`).join('\n')
    expect(unused.length === 0 ? '' : `\nUnused exports (unexport or delete, or register an exemption):\n${report}\n`).toBe('')
  })

  test('every exemption still covers an unused export', () => {
    const unused = findUnusedExports(collectSourceFiles(), [])
    const stale = UNUSED_EXPORT_EXEMPT.filter(
      (e) => !unused.some((u) => u.file.startsWith(e.path) && (e.name === undefined || e.name === u.name)),
    )
    const report = stale.map((e) => `  ${e.path}${e.name ? ` "${e.name}"` : ''}`).join('\n')
    expect(stale.length === 0 ? '' : `\nStale exemptions (the export is used or gone; remove the entry):\n${report}\n`).toBe('')
  })

  test('reports an export no other file imports, even when its own file uses it', () => {
    const files = [
      { path: 'src/pin/pinLayout.ts', content: 'export function pinOffset(): number {\n  return 2\n}\nexport const PIN = pinOffset()' },
      { path: 'src/pin/Pin.tsx', content: "import { PIN } from './pinLayout'\nconst size = PIN" },
    ]
    expect(findUnusedExports(files, [])).toEqual([{ file: 'src/pin/pinLayout.ts', name: 'pinOffset' }])
  })

  test('an aliased, type-only or multi-line import uses the name it imports, through the @/ alias too', () => {
    const files = [
      {
        path: 'src/trails/types.ts',
        content: [
          'export interface Trail {}',
          'export type TrailId = string',
          'export enum Kind {}',
          'export const enum Tone {}',
          'export abstract class Base {}',
          'export async function load(): Promise<void> {}',
          'export function unused(): void {}',
        ].join('\n'),
      },
      {
        path: 'src/screens/List.tsx',
        content: [
          "import type { Trail } from '@/trails/types'",
          "import { type TrailId, Kind as TrailKind } from '../trails/types'",
          'import {',
          '  Tone,',
          '  Base,',
          '  load,',
          "} from '@/trails/types'",
        ].join('\n'),
      },
    ]
    expect(findUnusedExports(files, [])).toEqual([{ file: 'src/trails/types.ts', name: 'unused' }])
  })

  test('a default export is the name "default", used by a default import', () => {
    const files = [
      { path: 'src/a.ts', content: 'export default function compute(): number {\n  return 1\n}\nexport const extra = 2' },
      { path: 'src/b.ts', content: 'export default 42' },
      { path: 'src/use.ts', content: "import compute, { extra } from './a'" },
    ]
    expect(findUnusedExports(files, [])).toEqual([{ file: 'src/b.ts', name: 'default' }])
  })

  test('an export list publishes the outer name of each specifier', () => {
    const files = [
      { path: 'src/a.ts', content: 'const inner = 1\nconst other = 2\nexport { inner as outer, other }' },
      { path: 'src/use.ts', content: "import { outer } from './a'" },
    ]
    expect(findUnusedExports(files, [])).toEqual([{ file: 'src/a.ts', name: 'other' }])
  })

  test('a named re-export is an export of the barrel, and an import through it uses the origin', () => {
    const files = [
      { path: 'src/log/logEvent.ts', content: 'export function logEvent(): void {}' },
      { path: 'src/log/deviceInfo.ts', content: 'export function deviceInfo(): string {\n  return ""\n}' },
      {
        path: 'src/log/index.ts',
        content: "export { logEvent as log } from './logEvent'\nexport type { deviceInfo } from './deviceInfo'",
      },
      { path: 'src/app.ts', content: "import { log } from '@/log'" },
    ]
    expect(findUnusedExports(files, [])).toEqual([
      { file: 'src/log/deviceInfo.ts', name: 'deviceInfo' },
      { file: 'src/log/index.ts', name: 'deviceInfo' },
    ])
  })

  test('export * forwards every name of its target, through nested barrels, and reports only at the origin', () => {
    const files = [
      { path: 'src/data/trails/types.ts', content: 'export interface Trail {}\nexport interface TrailDraft {}' },
      { path: 'src/data/trails/repository.ts', content: 'export interface TrailsRepository {}' },
      { path: 'src/data/trails/model.ts', content: "export * from './types'" },
      { path: 'src/data/trails/index.ts', content: "export * from './model'\nexport * from './repository'" },
      { path: 'src/store.ts', content: "import type { Trail, TrailsRepository } from '@/data/trails'" },
    ]
    expect(findUnusedExports(files, [])).toEqual([{ file: 'src/data/trails/types.ts', name: 'TrailDraft' }])
  })

  test('export * as publishes one name that uses the whole target', () => {
    const files = [
      { path: 'src/geo/math.ts', content: 'export const a = 1\nexport const b = 2' },
      { path: 'src/geo/index.ts', content: "export * as math from './math'\nexport * as unusedMath from './math'" },
      { path: 'src/use.ts', content: "import { math } from './geo'" },
    ]
    expect(findUnusedExports(files, [])).toEqual([{ file: 'src/geo/index.ts', name: 'unusedMath' }])
  })

  test('a namespace import, require or dynamic import uses every export of its target', () => {
    const files = [
      { path: 'src/db/schema.ts', content: 'export const trails = 1\nexport const activities = 2' },
      { path: 'src/db/lazy.ts', content: 'export const heavy = 1' },
      { path: 'src/db/legacy.ts', content: 'export const old = 1' },
      {
        path: 'src/db/client.ts',
        content: "import * as schema from './schema'\nconst lazy = () => import('./lazy')\nconst legacy = require('./legacy')",
      },
    ]
    expect(findUnusedExports(files, [])).toEqual([])
  })

  test('a route file under app/ needs no importer for the names expo-router reads by convention', () => {
    const files = [
      { path: 'app/trails.tsx', content: 'export default function TrailsScreen() {}\nexport function helper(): void {}' },
      { path: 'app/_layout.tsx', content: 'export const unstable_settings = {}\nexport function ErrorBoundary() {}' },
      { path: 'app/+native-intent.ts', content: 'export function redirectSystemPath(): string {\n  return "/"\n}' },
      { path: 'src/screens/Trails.tsx', content: 'export default function Trails() {}' },
    ]
    expect(findUnusedExports(files, [])).toEqual([
      { file: 'app/trails.tsx', name: 'helper' },
      { file: 'src/screens/Trails.tsx', name: 'default' },
    ])
  })

  test('honours an exemption for one export or for every export under a path', () => {
    const files = [
      { path: 'src/architecture/seams.ts', content: 'export const SEAMS = []' },
      { path: 'src/pin/pinLayout.ts', content: 'export const kept = 1\nexport const dead = 2' },
    ]
    const exempt = [
      { path: 'src/architecture/', rationale: 'test' },
      { path: 'src/pin/pinLayout.ts', name: 'kept', rationale: 'test' },
    ]
    expect(findUnusedExports(files, exempt)).toEqual([{ file: 'src/pin/pinLayout.ts', name: 'dead' }])
  })

  test('ignores export and import text in comments and strings', () => {
    const files = [
      {
        path: 'src/a.ts',
        content: "// export function commented() {}\nconst note = 'export function quoted() {}'\n/*\nexport const inBlock = 1\n*/",
      },
      { path: 'src/b.ts', content: 'export const real = 1' },
      { path: 'src/c.ts', content: "// import { real } from './b'\nconst s = \"import { real } from './b'\"" },
    ]
    expect(findUnusedExports(files, [])).toEqual([{ file: 'src/b.ts', name: 'real' }])
  })
})
