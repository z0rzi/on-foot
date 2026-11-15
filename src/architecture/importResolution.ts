import * as path from 'node:path'
import { SourceFile } from './sourceScan'

const SPECIFIER = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|(?:require|import)\(\s*['"]([^'"]+)['"]/g

export function importSpecifiers(content: string): string[] {
  const found: string[] = []
  for (const m of content.matchAll(SPECIFIER)) {
    found.push(m[1] ?? m[2] ?? m[3])
  }
  return found
}

// A whole-declaration `import type` or `export type` is erased by the compiler, so it loads nothing at
// runtime. An inline `{ type X }` is kept: the declaration may still bind a value.
const TYPE_ONLY_DECLARATION = /\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s*from\s*['"][^'"]+['"]/g

export function runtimeImportSpecifiers(content: string): string[] {
  return importSpecifiers(content.replace(TYPE_ONLY_DECLARATION, ''))
}

const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

export function resolveImport(fromPath: string, spec: string, known: Set<string>): string | null {
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

interface ResolvedImport {
  spec: string
  target: string | null
}

// Each file's imports in source order: `target` is the source file a specifier names, or null for a
// package or a path outside `files`. `specifiersOf` picks which imports count.
export function resolvedImportGraph(
  files: SourceFile[],
  specifiersOf: (content: string) => string[],
): Map<string, ResolvedImport[]> {
  const known = new Set(files.map((f) => f.path))
  return new Map(
    files.map((file) => [
      file.path,
      specifiersOf(file.content).map((spec) => ({ spec, target: resolveImport(file.path, spec, known) })),
    ]),
  )
}
