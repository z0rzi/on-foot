import { resolvedImportGraph, runtimeImportSpecifiers } from './importResolution'
import { SourceFile } from './sourceScan'

const ENTRY = 'index.ts'
const BOOTSTRAP = 'src/bootstrap/index.ts'
const RUNTIME_STARTED = 'src/bootstrap/runtimeStarted.ts'
const ROUTES = 'expo-router/entry'
const TASK = 'src/recording/locationTask.ts'
const ROUTE_DIR = 'app/'
const TIMER_CALL = /\b(?:setTimeout|setInterval)\s*\(/
// A headless start mounts no view and its JS timers stay paused: the task's graph holds no map, no UI
// and no timer, which would hang the delivery.
const NOT_HEADLESS = [
  { matches: ({ path }: SourceFile) => path.startsWith('src/map/'), label: 'a map module' },
  {
    matches: ({ path }: SourceFile) => path.startsWith('src/components/') || path.endsWith('.tsx'),
    label: 'a UI module',
  },
  { matches: ({ content }: SourceFile) => TIMER_CALL.test(content), label: 'a module that sets a timer' },
]

export interface HeadlessEntry {
  main: string | undefined
  entry: string
  files: SourceFile[]
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

export function findHeadlessEntryViolations({ main, entry, files }: HeadlessEntry): string[] {
  const graph = resolvedImportGraph([{ path: ENTRY, content: entry }, ...files], runtimeImportSpecifiers)
  const importsOf = (from: string) => (graph.get(from) ?? []).map(({ spec, target }) => target ?? spec)
  const violations: string[] = []
  if (main !== ENTRY) violations.push(`package.json main is ${main ?? 'unset'} -> make it ${ENTRY}`)

  const entryImports = importsOf(ENTRY)
  if (!sameList(entryImports, [BOOTSTRAP, ROUTES])) {
    violations.push(`${ENTRY} imports ${entryImports.join(', ') || 'nothing'} -> import ${BOOTSTRAP}, then ${ROUTES}, and nothing else`)
  }

  const bootstrapImports = importsOf(BOOTSTRAP)
  if (!sameList(bootstrapImports, [RUNTIME_STARTED, TASK])) {
    violations.push(
      `${BOOTSTRAP} imports ${bootstrapImports.join(', ') || 'nothing'} -> import ${RUNTIME_STARTED}, then ${TASK}, and nothing else: the log and its error handler come first, then the task in every runtime`,
    )
  }

  for (const file of files) {
    if (file.path.startsWith(ROUTE_DIR) && importsOf(file.path).includes(TASK)) {
      violations.push(`${file.path} imports ${TASK} -> only ${BOOTSTRAP} does; a headless start renders no route`)
    }
  }

  const reached = new Set<string>()
  const walk = (path: string) => {
    if (!graph.has(path) || reached.has(path)) return
    reached.add(path)
    for (const target of importsOf(path)) walk(target)
  }
  walk(TASK)
  for (const file of files.filter((f) => reached.has(f.path))) {
    for (const rule of NOT_HEADLESS.filter((r) => r.matches(file))) {
      violations.push(`${TASK} reaches ${file.path}, ${rule.label} -> keep the task's graph headless`)
    }
  }
  return violations
}
