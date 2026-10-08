import { SourceFile } from './sourceScan'

// Directory-scoped export bans: what a directory may not become, where importRules.ts governs what
// it may not reach for. A name is a proxy — "produces a display string" is not mechanically
// checkable — so this catches the shape ARCH-1 took rather than the idea behind it.
export interface ExportRule {
  within: string
  mustNotExport: RegExp
  rationale: string
}

export const EXPORT_RULES: ExportRule[] = [
  {
    within: 'src/data/',
    mustNotExport: /^format[A-Z]/,
    rationale:
      'Presentation logic (formatters, view helpers) does not belong in the data layer (POST-WORK.md). ARCH-1 was three formatters defined in data/geo; the import rule next door stops this directory reaching for one, and this rule stops it growing its own. The name is a proxy for "returns a string for the screen", which cannot be checked mechanically.',
  },
]

export interface ExportRuleViolation {
  file: string
  symbol: string
  rationale: string
}

const exportedValueNames = (content: string): string[] => {
  const pattern = /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm
  return [...content.matchAll(pattern)].map((match) => match[1])
}

export function findExportRuleViolations(
  files: SourceFile[],
  rules: ExportRule[] = EXPORT_RULES,
): ExportRuleViolation[] {
  const violations: ExportRuleViolation[] = []
  for (const rule of rules) {
    for (const file of files) {
      if (!file.path.startsWith(rule.within)) continue
      for (const symbol of exportedValueNames(file.content)) {
        if (rule.mustNotExport.test(symbol)) {
          violations.push({ file: file.path, symbol, rationale: rule.rationale })
        }
      }
    }
  }
  return violations
}
