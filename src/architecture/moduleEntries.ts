import { importSpecifiers, resolvedImportGraph } from './importResolution'
import { SourceFile } from './sourceScan'

// Modules with a single public entry: code outside the directory imports its `index`, never a file
// inside it. Where importRules.ts bans one directory reaching another, this keeps a module's
// internals private to the module.
export interface ModuleEntry {
  module: string
  rationale: string
}

export const MODULE_ENTRIES: ModuleEntry[] = [
  {
    module: 'src/log',
    rationale:
      'The debug log is consumed app-wide; src/log/index.ts is its public surface, so its files can be split or renamed without touching consumers (PROP-7).',
  },
]

export interface ModuleEntryViolation {
  file: string
  module: string
  target: string
  rationale: string
}

const ENTRY_FILES = ['index.ts', 'index.tsx']

export function findModuleEntryViolations(
  files: SourceFile[],
  entries: ModuleEntry[] = MODULE_ENTRIES,
): ModuleEntryViolation[] {
  const graph = resolvedImportGraph(files, importSpecifiers)
  const violations: ModuleEntryViolation[] = []
  for (const entry of entries) {
    const inside = `${entry.module}/`
    const publicFiles = new Set(ENTRY_FILES.map((name) => inside + name))
    for (const [from, imports] of graph) {
      if (from.startsWith(inside)) continue
      for (const { target } of imports) {
        if (target && target.startsWith(inside) && !publicFiles.has(target)) {
          violations.push({ file: from, module: entry.module, target, rationale: entry.rationale })
        }
      }
    }
  }
  return violations
}
