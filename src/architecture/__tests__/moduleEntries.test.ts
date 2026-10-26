import { MODULE_ENTRIES, findModuleEntryViolations } from '../moduleEntries'
import { collectSourceFiles } from '../sourceScan'

const LOG = [{ module: 'src/log', rationale: 'test' }]
const logFiles = [
  { path: 'src/log/index.ts', content: "export { logEvent } from './logEvent'" },
  { path: 'src/log/logEvent.ts', content: 'export function logEvent() {}' },
  { path: 'src/log/deviceInfo.ts', content: "import { logEvent } from './logEvent'" },
]

describe('module entries', () => {
  test('no source file reaches past a module entry', () => {
    const violations = findModuleEntryViolations(collectSourceFiles(), MODULE_ENTRIES)
    const report = violations
      .map((v) => `  ${v.file} imports ${v.target}, not ${v.module}/index\n    -> ${v.rationale}`)
      .join('\n')
    expect(violations.length === 0 ? '' : `\nModule entry violations:\n${report}\n`).toBe('')
  })

  test('flags an outside file importing a module file by path', () => {
    const files = [...logFiles, { path: 'src/recording/task.ts', content: "import { deviceInfo } from '../log/deviceInfo'" }]
    expect(findModuleEntryViolations(files, LOG)).toEqual([
      { file: 'src/recording/task.ts', module: 'src/log', target: 'src/log/deviceInfo.ts', rationale: 'test' },
    ])
  })

  test('flags a deep import through the @/ alias or from app/', () => {
    const files = [
      ...logFiles,
      { path: 'src/map/a.ts', content: "import { logEvent } from '@/log/logEvent'" },
      { path: 'app/_layout.tsx', content: "import { deviceInfo } from '../src/log/deviceInfo'" },
    ]
    expect(findModuleEntryViolations(files, LOG).map((v) => v.file)).toEqual(['src/map/a.ts', 'app/_layout.tsx'])
  })

  test('allows the entry itself, and files inside the module importing each other', () => {
    const files = [
      ...logFiles,
      { path: 'src/map/a.ts', content: "import { logEvent } from '../log'" },
      { path: 'app/x.tsx', content: "import { logEvent } from '../src/log/index'" },
    ]
    expect(findModuleEntryViolations(files, LOG)).toHaveLength(0)
  })

  test('does not confuse a module with a same-named directory elsewhere', () => {
    const files = [
      ...logFiles,
      { path: 'src/data/log/mapping.ts', content: '' },
      { path: 'src/data/db/repo.ts', content: "import { rowToEntry } from '../log/mapping'" },
    ]
    expect(findModuleEntryViolations(files, LOG)).toHaveLength(0)
  })
})
