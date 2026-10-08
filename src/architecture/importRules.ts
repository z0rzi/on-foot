import { SourceFile } from './sourceScan'

// Directory-scoped import bans: one-way boundaries that are not native-SDK seams (see seams.ts)
// but still must not be crossed. Each rule names the directory it governs, the module that
// directory may not reach, and why.
export interface ImportRule {
  within: string
  mustNotImport: string
  rationale: string
}

export const IMPORT_RULES: ImportRule[] = [
  {
    within: 'src/data/',
    mustNotImport: 'settings/preferencesStore',
    rationale:
      'Elevation smoothing is a display control for slope-band legibility. The gain/loss written to the database is computed with the fixed window in data/geo/elevationFilter and must never depend on a user setting.',
  },
  {
    within: 'src/data/',
    mustNotImport: 'format/units',
    rationale:
      'The data layer computes and persists; turning a value into a string for the screen is presentation. Formatters living in data/geo is what ARCH-1 was, and this rule is what stops it coming back.',
  },
]

export interface ImportRuleViolation {
  file: string
  mustNotImport: string
  rationale: string
}

const importPattern = (target: string): RegExp => {
  const t = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:from|import|require\\()\\s*['"][^'"]*${t}['"]`)
}

export function findImportRuleViolations(
  files: SourceFile[],
  rules: ImportRule[] = IMPORT_RULES,
): ImportRuleViolation[] {
  const violations: ImportRuleViolation[] = []
  for (const rule of rules) {
    const re = importPattern(rule.mustNotImport)
    for (const file of files) {
      if (!file.path.startsWith(rule.within)) continue
      if (re.test(file.content)) {
        violations.push({ file: file.path, mustNotImport: rule.mustNotImport, rationale: rule.rationale })
      }
    }
  }
  return violations
}
