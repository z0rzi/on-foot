import { EXPORT_RULES, findExportRuleViolations } from '../exportRules'
import { collectSourceFiles } from '../sourceScan'

describe('directory export rules', () => {
  test('no source file exports a symbol its directory may not', () => {
    const violations = findExportRuleViolations(collectSourceFiles(), EXPORT_RULES)
    const report = violations
      .map((v) => `  ${v.file} exports "${v.symbol}"\n    -> ${v.rationale}`)
      .join('\n')
    expect(violations.length === 0 ? '' : `\nExport rule violations:\n${report}\n`).toBe('')
  })

  test('flags a formatter defined in the data layer', () => {
    const files = [
      { path: 'src/data/geo/metrics.ts', content: 'export function formatDistance(meters: number): string {\n  return `${meters} m`\n}' },
    ]
    expect(findExportRuleViolations(files)).toHaveLength(1)
  })

  test('flags the const form too, since that is how the next one will be written', () => {
    const files = [
      { path: 'src/data/geo/metrics.ts', content: "export const formatElevation = (m: number): string => `${m} m`" },
    ]
    expect(findExportRuleViolations(files)).toHaveLength(1)
  })

  test('allows the data layer to export computation', () => {
    const files = [
      { path: 'src/data/geo/metrics.ts', content: 'export function computeMetrics(points: GpxPoint[]): TrailMetrics {\n  return null as never\n}' },
    ]
    expect(findExportRuleViolations(files)).toHaveLength(0)
  })

  test('allows the same export outside the governed directory', () => {
    const files = [
      { path: 'src/format/units.ts', content: 'export function formatDistance(meters: number): string {\n  return `${meters} m`\n}' },
    ]
    expect(findExportRuleViolations(files)).toHaveLength(0)
  })

  test('ignores a formatter name in a comment or a string', () => {
    const files = [
      { path: 'src/data/geo/metrics.ts', content: "// formatDistance lives in format/units now\nconst note = 'export function formatDistance'" },
    ]
    expect(findExportRuleViolations(files)).toHaveLength(0)
  })
})
