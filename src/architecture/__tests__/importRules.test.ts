import { IMPORT_RULES, findImportRuleViolations } from '../importRules'
import { collectSourceFiles } from '../sourceScan'

describe('directory import rules', () => {
  test('no source file reaches across a banned boundary', () => {
    const violations = findImportRuleViolations(collectSourceFiles(), IMPORT_RULES)
    const report = violations
      .map((v) => `  ${v.file} imports "${v.mustNotImport}"\n    -> ${v.rationale}`)
      .join('\n')
    expect(violations.length === 0 ? '' : `\nImport rule violations:\n${report}\n`).toBe('')
  })

  test('flags the data layer reading a display preference', () => {
    const files = [
      { path: 'src/data/geo/metrics.ts', content: "import { usePreferencesStore } from '../../settings/preferencesStore'" },
    ]
    expect(findImportRuleViolations(files)).toHaveLength(1)
  })

  test('flags the data layer reaching for a unit formatter', () => {
    const files = [
      { path: 'src/data/geo/metrics.ts', content: "import { formatDistance } from '../../format/units'" },
    ]
    expect(findImportRuleViolations(files)).toHaveLength(1)
  })

  test('allows the same import outside the governed directory', () => {
    const files = [
      { path: 'src/map/useRouteDisplay.ts', content: "import { usePreferencesStore } from '../settings/preferencesStore'" },
    ]
    expect(findImportRuleViolations(files)).toHaveLength(0)
  })

  test('ignores the module name in comments or strings', () => {
    const files = [
      { path: 'src/data/geo/metrics.ts', content: "// never read settings/preferencesStore here\nconst x = 'settings/preferencesStore'" },
    ]
    expect(findImportRuleViolations(files)).toHaveLength(0)
  })
})
