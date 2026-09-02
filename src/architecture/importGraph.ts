import * as path from 'node:path'
import { SourceFile } from './sourceScan'

const SPECIFIER = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|(?:require|import)\(\s*['"]([^'"]+)['"]/g

function specifiers(content: string): string[] {
  const found: string[] = []
  for (const m of content.matchAll(SPECIFIER)) {
    found.push(m[1] ?? m[2] ?? m[3])
  }
  return found
}

const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

function resolve(fromPath: string, spec: string, known: Set<string>): string | null {
  let base: string
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`
  else if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(fromPath), spec)
  else return null
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = base + suffix
    if (known.has(candidate)) return candidate
  }
  return null
}

export function findImportCycles(files: SourceFile[]): string[][] {
  const known = new Set(files.map((f) => f.path))
  const graph = new Map<string, string[]>()
  for (const file of files) {
    const deps = new Set<string>()
    for (const spec of specifiers(file.content)) {
      const target = resolve(file.path, spec, known)
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
