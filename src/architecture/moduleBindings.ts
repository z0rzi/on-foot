interface ImportBinding {
  spec: string
  names: string[]
}

interface ReExport {
  spec: string
  imported: string
  exported: string
}

interface ModuleBindings {
  declared: string[]
  reExports: ReExport[]
  stars: string[]
  imports: ImportBinding[]
}

const IDENTIFIER = '[A-Za-z_$][\\w$]*'
const DECLARATION = new RegExp(
  `^export\\s+(?:declare\\s+)?(?:async\\s+|abstract\\s+)?(?:function\\*?|const\\s+enum|const|let|var|class|interface|type|enum|namespace)\\s+(${IDENTIFIER})`,
  'gm',
)
const DEFAULT_EXPORT = /^export\s+default\b/gm
const EXPORT_LIST = /^export\s+(?:type\s+)?\{([^}]*)\}(?!\s*from\b)/gm
const RE_EXPORT_LIST = /^export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm
const STAR_AS = new RegExp(`^export\\s+\\*\\s+as\\s+(${IDENTIFIER})\\s+from\\s*['"]([^'"]+)['"]`, 'gm')
const STAR = /^export\s+\*\s+from\s*['"]([^'"]+)['"]/gm
const IMPORT = /^import\s+(?:type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/gm
const LOAD_CALL = /(?:require|import)\(\s*['"]([^'"]+)['"]/g
const DEFAULT_BINDING = new RegExp(`^${IDENTIFIER}`)

interface Specifier {
  local: string
  exported: string
}

const specifiers = (list: string): Specifier[] =>
  list
    .split(',')
    .map((s) => s.trim().replace(/^type\s+/, ''))
    .filter(Boolean)
    .map((s) => {
      const [local, exported] = s.split(/\s+as\s+/).map((part) => part.trim())
      return { local, exported: exported ?? local }
    })

const importedNames = (clause: string): string[] => {
  const names: string[] = []
  const named = clause.match(/\{([^}]*)\}/)
  if (named) names.push(...specifiers(named[1]).map((s) => s.local))
  if (/\*\s*as\s/.test(clause)) names.push('*')
  if (DEFAULT_BINDING.test(clause)) names.push('default')
  return names
}

// A block comment is stripped only when it opens a line, so a '/*' inside a string (a glob) is
// never read as one. Line comments and strings need no stripping: every pattern is anchored to
// the start of a line.
const BLOCK_COMMENT = /^\s*\/\*[\s\S]*?\*\//gm

export function moduleBindings(source: string): ModuleBindings {
  const content = source.replace(BLOCK_COMMENT, '')
  return {
    declared: [
      ...[...content.matchAll(DECLARATION)].map((m) => m[1]),
      ...[...content.matchAll(DEFAULT_EXPORT)].map(() => 'default'),
      ...[...content.matchAll(EXPORT_LIST)].flatMap((m) => specifiers(m[1]).map((s) => s.exported)),
    ],
    reExports: [
      ...[...content.matchAll(RE_EXPORT_LIST)].flatMap((m) =>
        specifiers(m[1]).map((s) => ({ spec: m[2], imported: s.local, exported: s.exported })),
      ),
      ...[...content.matchAll(STAR_AS)].map((m) => ({ spec: m[2], imported: '*', exported: m[1] })),
    ],
    stars: [...content.matchAll(STAR)].map((m) => m[1]),
    imports: [
      ...[...content.matchAll(IMPORT)].map((m) => ({ spec: m[2], names: importedNames(m[1]) })),
      ...[...content.matchAll(LOAD_CALL)].map((m) => ({ spec: m[1], names: ['*'] })),
    ],
  }
}
