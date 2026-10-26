import { importSpecifiers, resolveImport } from './importResolution'
import { SourceFile } from './sourceScan'

export function findImportCycles(files: SourceFile[]): string[][] {
  const known = new Set(files.map((f) => f.path))
  const graph = new Map<string, string[]>()
  for (const file of files) {
    const deps = new Set<string>()
    for (const spec of importSpecifiers(file.content)) {
      const target = resolveImport(file.path, spec, known)
      if (target && target !== file.path) deps.add(target)
    }
    graph.set(file.path, [...deps])
  }

  const state = new Map<string, 'open' | 'done'>()
  const stack: string[] = []
  const cycles: string[][] = []
  const dfs = (node: string) => {
    state.set(node, 'open')
    stack.push(node)
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === 'open') {
        cycles.push(stack.slice(stack.indexOf(next)).concat(next))
      } else if (!state.has(next)) {
        dfs(next)
      }
    }
    stack.pop()
    state.set(node, 'done')
  }
  for (const file of files) if (!state.has(file.path)) dfs(file.path)

  const seen = new Set<string>()
  const unique: string[][] = []
  for (const cycle of cycles) {
    const key = [...cycle.slice(0, -1)].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(cycle)
  }
  return unique
}
