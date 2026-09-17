export interface Seam {
  name: string
  tokens: string[]
  allow: string[]
  rationale: string
}

export const SEAMS: Seam[] = [
  {
    name: 'map-provider',
    tokens: ['@rnmapbox/maps'],
    allow: ['src/map/providers/'],
    rationale:
      'Only a map provider may import a map SDK; the store, UI, and shared map code talk to the semantic port at src/map/provider/.',
  },
  {
    name: 'persistence',
    tokens: ['expo-sqlite', 'drizzle-orm'],
    allow: ['src/data/db/'],
    rationale:
      'Only src/data/db owns the database engine; domain and UI code depend on repository interfaces and leaf types, never the engine.',
  },
  {
    name: 'net',
    tokens: ['@react-native-community/netinfo'],
    allow: ['src/net/'],
    rationale:
      'Only src/net wraps the connectivity SDK; consumers use ConnectivityStatus and the wrapper, never NetInfo directly.',
  },
  {
    name: 'location',
    tokens: ['expo-location', 'expo-task-manager'],
    allow: ['src/location/'],
    rationale:
      'Only src/location wraps the location SDK and its background task; recording and map code use the location port, never the SDK.',
  },
]

const importPattern = (token: string): RegExp => {
  const t = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const specifier = `['"]${t}(?:['"]|/)`
  return new RegExp(
    `(?:(?:import|export)[^'"\\n]*from\\s*${specifier})|(?:import\\s*${specifier})|(?:require\\(\\s*${specifier})`,
  )
}

export interface SeamViolation {
  seam: string
  token: string
  file: string
  rationale: string
}

export function findSeamViolations(
  files: { path: string; content: string }[],
  seams: Seam[] = SEAMS,
): SeamViolation[] {
  const violations: SeamViolation[] = []
  for (const seam of seams) {
    const patterns = seam.tokens.map((token) => ({ token, re: importPattern(token) }))
    for (const file of files) {
      if (seam.allow.some((prefix) => file.path.startsWith(prefix))) continue
      for (const { token, re } of patterns) {
        if (re.test(file.content)) {
          violations.push({ seam: seam.name, token, file: file.path, rationale: seam.rationale })
        }
      }
    }
  }
  return violations
}

