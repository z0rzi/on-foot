import { readRepoJson } from './repoFiles'

// Agent directories hold worktrees and throwaway files. Every gate skips them, or a worktree's
// copy of the app is typechecked, tested or linted a second time from the root.
const AGENT_DIRS = ['.claude', '.scratch']

// Each gate's own spelling of "this whole directory".
const WHOLE_DIR_ENTRY = {
  jest: (dir: string) => `/${dir}/`,
  tsc: (dir: string) => `${dir}/**`,
  eslint: (dir: string) => `${dir}/**`,
}

export type Gate = keyof typeof WHOLE_DIR_ENTRY
export type GateIgnores = Record<Gate, string[]>

export interface ScopeGap {
  gate: Gate
  dir: string
  entry: string
}

export function findScopeGaps(ignores: GateIgnores, dirs: string[] = AGENT_DIRS): ScopeGap[] {
  const gaps: ScopeGap[] = []
  for (const gate of Object.keys(WHOLE_DIR_ENTRY) as Gate[]) {
    for (const dir of dirs) {
      const entry = WHOLE_DIR_ENTRY[gate](dir)
      if (!ignores[gate].includes(entry)) gaps.push({ gate, dir, entry })
    }
  }
  return gaps
}

interface PackageJson {
  jest?: { testPathIgnorePatterns?: string[] }
}

interface TsConfig {
  exclude?: string[]
}

// eslint's global ignores are the config objects that hold nothing but `ignores`.
function eslintGlobalIgnores(config: unknown): string[] {
  if (!Array.isArray(config)) return []
  return config.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return []
    const keys = Object.keys(entry)
    const ignores = (entry as { ignores?: unknown }).ignores
    return keys.length === 1 && Array.isArray(ignores) ? ignores.filter((i) => typeof i === 'string') : []
  })
}

// eslint.config.js is code, so the caller loads it and passes what it exports.
export function readGateIgnores(eslintConfig: unknown, rootDir: string = process.cwd()): GateIgnores {
  return {
    jest: readRepoJson<PackageJson>('package.json', rootDir).jest?.testPathIgnorePatterns ?? [],
    tsc: readRepoJson<TsConfig>('tsconfig.json', rootDir).exclude ?? [],
    eslint: eslintGlobalIgnores(eslintConfig),
  }
}
