import * as path from 'node:path'

const SPECIFIER = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|(?:require|import)\(\s*['"]([^'"]+)['"]/g

export function importSpecifiers(content: string): string[] {
  const found: string[] = []
  for (const m of content.matchAll(SPECIFIER)) {
    found.push(m[1] ?? m[2] ?? m[3])
  }
  return found
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
