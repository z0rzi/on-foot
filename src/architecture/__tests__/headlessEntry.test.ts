import { findHeadlessEntryViolations, HeadlessEntry } from '../headlessEntry'
import { readRepoJson, readRepoText } from '../repoFiles'
import { collectSourceFiles } from '../sourceScan'

const wellFormed: HeadlessEntry = {
  main: 'index.ts',
  entry: "import './src/bootstrap'\nimport 'expo-router/entry'\n",
  files: [
    { path: 'src/bootstrap/index.ts', content: "import './runtimeStarted'\nimport '../recording/locationTask'" },
    { path: 'src/bootstrap/runtimeStarted.ts', content: "import { logEvent } from '../log'" },
    { path: 'src/log/index.ts', content: '' },
    { path: 'src/recording/locationTask.ts', content: "import { useRecordingStore } from './recordingStore'" },
    { path: 'src/recording/recordingStore.ts', content: "import { create } from 'zustand'" },
    { path: 'app/_layout.tsx', content: "import { useResumeRecording } from '../src/recording/useResumeRecording'" },
    { path: 'src/recording/useResumeRecording.ts', content: '' },
  ],
}

const withFile = (path: string, content: string): HeadlessEntry => ({
  ...wellFormed,
  files: [...wellFormed.files.filter((f) => f.path !== path), { path, content }],
})

describe('the background task is defined first in every runtime', () => {
  test('the bundle entry defines the task before any route, and the task stays headless', () => {
    const violations = findHeadlessEntryViolations({
      main: readRepoJson<{ main?: string }>('package.json').main,
      entry: readRepoText('index.ts'),
      files: collectSourceFiles(),
    })
    const report = violations.map((v) => `  ${v}`).join('\n')
    expect(violations.length === 0 ? '' : `\nHeadless entry broken:\n${report}\n`).toBe('')
  })

  test('passes a well-formed entry', () => {
    expect(findHeadlessEntryViolations(wellFormed)).toEqual([])
  })

  test('flags a package whose main is not the root entry', () => {
    expect(findHeadlessEntryViolations({ ...wellFormed, main: 'expo-router/entry' })).toHaveLength(1)
  })

  test('flags an entry that loads the routes before bootstrap', () => {
    const entry = "import 'expo-router/entry'\nimport './src/bootstrap'\n"
    expect(findHeadlessEntryViolations({ ...wellFormed, entry })).toHaveLength(1)
  })

  test('flags an entry that imports anything besides bootstrap and the routes', () => {
    const entry = "import './src/bootstrap'\nimport './src/polyfills'\nimport 'expo-router/entry'\n"
    expect(findHeadlessEntryViolations({ ...wellFormed, entry })).toHaveLength(1)
  })

  test('flags a bootstrap that does not define the task', () => {
    expect(findHeadlessEntryViolations(withFile('src/bootstrap/index.ts', "import './runtimeStarted'"))).toHaveLength(1)
  })

  test('flags a missing bootstrap', () => {
    const fixture = { ...wellFormed, files: wellFormed.files.filter((f) => f.path !== 'src/bootstrap/index.ts') }
    expect(findHeadlessEntryViolations(fixture)).toContainEqual(expect.stringContaining('src/bootstrap/index.ts imports nothing'))
  })

  test('flags a bootstrap that defines the task before the runtime is logged', () => {
    const bootstrap = "import '../recording/locationTask'\nimport './runtimeStarted'"
    expect(findHeadlessEntryViolations(withFile('src/bootstrap/index.ts', bootstrap))).toHaveLength(1)
  })

  test('flags a bootstrap that loads anything ahead of the runtime log', () => {
    const bootstrap = "import '../map/warmUp'\nimport './runtimeStarted'\nimport '../recording/locationTask'"
    expect(findHeadlessEntryViolations(withFile('src/bootstrap/index.ts', bootstrap))).toHaveLength(1)
  })

  test('flags a route that imports the task', () => {
    const layout = "import '../src/recording/locationTask'"
    expect(findHeadlessEntryViolations(withFile('app/_layout.tsx', layout))).toHaveLength(1)
  })

  test('flags a map module reached from the task through another module', () => {
    const fixture = withFile('src/recording/recordingStore.ts', "import { useMapStore } from '../map/mapStore'")
    fixture.files.push({ path: 'src/map/mapStore.ts', content: '' })
    expect(findHeadlessEntryViolations(fixture)).toHaveLength(1)
  })

  test('flags a UI component reached from the task', () => {
    const fixture = withFile('src/recording/recordingStore.ts', "import { Badge } from '../activities/Badge'")
    fixture.files.push({ path: 'src/activities/Badge.tsx', content: '' })
    expect(findHeadlessEntryViolations(fixture)).toHaveLength(1)
  })

  test('flags a non-component module under src/components reached from the task', () => {
    const fixture = withFile('src/recording/recordingStore.ts', "import { rowsOf } from '../components/rowsOf'")
    fixture.files.push({ path: 'src/components/rowsOf.ts', content: '' })
    expect(findHeadlessEntryViolations(fixture)).toHaveLength(1)
  })

  test('flags a timer set in a module the task reaches', () => {
    const store = "import { create } from 'zustand'\nexport const flush = () => setTimeout(save, 500)"
    expect(findHeadlessEntryViolations(withFile('src/recording/recordingStore.ts', store))).toHaveLength(1)
  })

  test('flags an interval set in a module the task reaches through another module', () => {
    const fixture = withFile('src/recording/recordingStore.ts', "import { poll } from '../net/poll'")
    fixture.files.push({ path: 'src/net/poll.ts', content: 'export const poll = () => setInterval(check, 1000)' })
    expect(findHeadlessEntryViolations(fixture)).toHaveLength(1)
  })

  test('a timer outside the task graph is not flagged', () => {
    const stopwatch = 'export const tick = () => setInterval(render, 1000)'
    expect(findHeadlessEntryViolations(withFile('src/recording/useResumeRecording.ts', stopwatch))).toEqual([])
  })

  test('a type alias does not hide the runtime import after it', () => {
    const fixture = withFile(
      'src/recording/recordingStore.ts',
      "export type Props = { a: number }\nexport { mapStore } from '../map/mapStore'",
    )
    fixture.files.push({ path: 'src/map/mapStore.ts', content: '' })
    expect(findHeadlessEntryViolations(fixture)).toHaveLength(1)
  })

  test('a type-only import of a UI module does not reach it at runtime', () => {
    const fixture = withFile(
      'src/recording/recordingStore.ts',
      "import type { MetricTile } from '../components/MetricsGrid'\nexport type { Tile } from '../components/Tile'",
    )
    fixture.files.push({ path: 'src/components/MetricsGrid.tsx', content: '' }, { path: 'src/components/Tile.tsx', content: '' })
    expect(findHeadlessEntryViolations(fixture)).toEqual([])
  })
})
