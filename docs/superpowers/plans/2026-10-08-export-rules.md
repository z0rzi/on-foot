# Export Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the data layer against *defining* a formatter, so the finding this project just closed (ARCH-1) cannot be reintroduced unnoticed.

**Architecture:** A new `src/architecture/exportRules.ts` mirroring `importRules.ts` exactly — a declarative rule list, a pure finder over `SourceFile[]`, a whole-tree test and fixture tests. One rule: nothing under `src/data/` may export a `format*` symbol.

**Tech Stack:** TypeScript 6, Jest 29 via jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-08-export-rules-design.md`

## Global Constraints

- **The rule must be proven non-vacuous by mutation.** A gate that cannot fail is precisely the defect ARCH-5 is about. Break the pattern, watch a fixture test fail, restore, watch it pass — both outputs in the report.
- **`^format[A-Z]` is a proxy, and the rationale must say so.** The real invariant ("the data layer must not produce display strings") is not mechanically checkable. Do not write a rationale that claims more than the rule does — over-claiming is exactly what ARCH-5 was raised for.
- **Do not touch the existing `format/units` import rule.** The two catch different things; both stay.
- **These documents must never assert anything false.** Derive every count by enumerating, never by assuming.
- NO JSDoc. Comments explain *why*, never what changed.
- Commit subjects: lowercase, conventional-commit prefix, ONE line, no body.
- Baseline, measured: **69 suites / 571 tests**. Expected after Task 1: **70 suites / 577 tests**. Task 2 changes neither.
- No device check is needed or possible: this is pure logic plus documentation.

---

### Task 1: the export rule and its tests

**Files:**
- Create: `src/architecture/exportRules.ts`
- Create: `src/architecture/__tests__/exportRules.test.ts`

**Interfaces:**
- Consumes: `SourceFile` and `collectSourceFiles` from `src/architecture/sourceScan.ts`.
- Produces: `EXPORT_RULES`, `findExportRuleViolations(files, rules?)`, and the `ExportRule` / `ExportRuleViolation` types. Task 2 references the rule but imports nothing.

- [ ] **Step 1: Write the failing tests**

Create `src/architecture/__tests__/exportRules.test.ts`. This mirrors `importRules.test.ts` — read that file first and match its structure and phrasing.

```ts
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
```

The last case matters: the pattern is anchored to the start of a line with `^…export`, so a mention inside a comment or a quoted string must not trip it. Without that test, a looser pattern would pass unnoticed and the rule would cry wolf on documentation.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/architecture/__tests__/exportRules.test.ts`
Expected: FAIL — `Cannot find module '../exportRules'`.

- [ ] **Step 3: Write the implementation**

Create `src/architecture/exportRules.ts`:

```ts
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

// A fresh regex per call: /g carries lastIndex between uses, and a shared one would skip matches.
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
```

Note the pattern matches only value exports (`function`, `const`, `let`, `var`, `class`). Types are PascalCase and would not match `^format[A-Z]` anyway.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/architecture/__tests__/exportRules.test.ts`
Expected: PASS, 6 tests. The whole-tree test passes because `src/data/` has no `format*` export today — confirm that yourself with:

```bash
grep -rnE "^export\s+(function|const|async function)\s+format" src/data/
```

Expected: no output.

- [ ] **Step 5: Prove the rule is not vacuous**

Two mutations, both of which must be reverted afterwards.

First, prove the fixtures pin the pattern. Temporarily change `mustNotExport` to `/^formatX[A-Z]/`, run `npx jest src/architecture`, and confirm the fixture tests FAIL. Restore it and confirm they pass.

Second, prove the whole-tree test would catch a real regression. Temporarily append this to `src/data/geo/metrics.ts`:

```ts
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(0)} m`
}
```

Run `npx jest src/architecture` and confirm the whole-tree test FAILS, naming `src/data/geo/metrics.ts` and `formatDistance`. This is the exact mutation that passed every gate before this change — it must now be caught. Remove it and confirm green, then check `git status` is clean.

Put all four command outputs in your report.

- [ ] **Step 6: Verify**

Run: `npm run verify`
Expected: green, **70 suites / 577 tests**. The duplication gate runs here too; if it flags `exportRules.ts` against `importRules.ts`, stop and report rather than reshaping either — that is a design signal, and the spec says so explicitly.

- [ ] **Step 7: Commit**

```bash
git add src/architecture
git commit -m "feat(architecture): gate the data layer against defining formatters"
```

---

### Task 2: close ARCH-5 and correct a false count

**Files:**
- Modify: `docs/reviews/2026-09-10-full-review.md`, `docs/reviews/2026-10-06-open-work.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Close ARCH-5**

In `docs/reviews/2026-09-10-full-review.md`, append to the ARCH-5 entry in the style the other closed findings use: `· **Done** (<commit>): \`src/architecture/exportRules.ts\` bans \`format*\` exports under \`src/data/\`, proven by mutation — re-adding \`formatDistance\` there now fails the architecture suite.`

Also revisit the ARCH-1 "Done" note. It currently says the import rule "does not stop a formatter being redefined inside `src/data/` (ARCH-5)". That is no longer true. Update it so it describes what is now the case.

- [ ] **Step 2: Correct the Duplication dashboard row**

That row reads `0 / 1 / 9`. Enumerate the open DUP findings yourself and set it to the true value. For reference, the expected enumeration is DUP-1 (should-fix) plus DUP-5, 6, 7, 9, 10, 11 (minor) — but verify each one's status in the document rather than trusting this list, and report what you found.

This drift dates to `9a69856`, where DUP-8 closed without the count being decremented. Say so in your report.

- [ ] **Step 3: Update the Architecture dashboard row and the open-work index**

The Architecture row counts ARCH-5 as open; decrement it and drop it from that row's summary text if named there.

In `docs/reviews/2026-10-06-open-work.md`: remove ARCH-5 from the "Open and outside the table entirely" list, add a "Closed below" entry naming what changed and the commit, and correct every count this makes wrong — the header's outside-the-table count, the "others" count, and the total. Derive each by enumerating.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: green, **70 suites / 577 tests**.

- [ ] **Step 5: Commit**

```bash
git add docs/reviews
git commit -m "docs(reviews): close arch-5 and correct the duplication count"
```
