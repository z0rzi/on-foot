# Stop the data layer defining formatters (ARCH-5)

Closes **ARCH-5**.

## Problem

`IMPORT_RULES` forbids `src/data/` *importing* `format/units`. ARCH-1 was formatters *defined* inside
`src/data/`. Those are different shapes, and only the first is gated. Proven by mutation on
2026-10-08: pasting the verbatim `formatDistance`/`formatElevation` bodies back into
`src/data/geo/metrics.ts` recreates ARCH-1 exactly and passes every architecture suite. The
duplication gate misses it too — each body is about two significant lines, well under its eight-line
window.

So the finding this project just closed can be reintroduced with no gate objecting, which makes the
closure weaker than it reads.

## Existing shape

The closest existing feature of the same shape is **`src/architecture/importRules.ts`**: a declarative
list of directory-scoped bans, each naming the directory it governs, the thing that directory may not
do, and why; plus a pure finder function over `SourceFile[]`, plus a test that runs it over the whole
tree and fixture tests that prove it fires.

This change copies that shape exactly — same four parts, same naming, same test structure. What is
*not* extracted to be shared: the loop body differs (one tests the file's text for an import
statement, the other tests each exported symbol's name), and the violation records carry different
fields. Factoring the two into one generic rule engine would couple them to save about six lines of
`for`. If the duplication gate disagrees, it will say so and that is the moment to extract.

## Design

New `src/architecture/exportRules.ts`, mirroring its import sibling:

```ts
export interface ExportRule {
  within: string
  mustNotExport: RegExp
  rationale: string
}

export const EXPORT_RULES: ExportRule[] = [
  {
    within: 'src/data/',
    mustNotExport: /^format[A-Z]/,
    rationale: '...',
  },
]

export function findExportRuleViolations(
  files: SourceFile[],
  rules?: ExportRule[],
): ExportRuleViolation[]
```

A violation names the file and the offending symbol.

### Why a name is the right predicate

The real invariant is "the data layer must not produce display strings", which is not mechanically
checkable — you cannot tell a display string from any other string. A name is a **proxy**, and the
rationale will say so rather than pretending otherwise.

`^format[A-Z]` is the tightest proxy that catches the real case. It matches `formatDistance`,
`formatBytes`, `formatMetricsSummary` — the three symbols ARCH-1 was about — and naturally excludes
types, which are PascalCase, and words like `formatted`.

It will also match a hypothetical legitimate name such as `formatVersion`. That is acceptable and is
how this project's checks are meant to behave: AGENTS.md says a check enforces a *response*, not an
*outcome*. If such a case ever arises the response is to rename it or to add an exemption then — not
to weaken the rule now for a case that does not exist.

### What it deliberately does not cover

Re-exports (`export { formatDistance } from '…'`) are not matched. They require an import, which the
existing `format/units` import rule already catches. Noting it here so the gap is a decision rather
than an oversight.

## Testing

Mirrors `importRules.test.ts`: one whole-tree test, plus fixture tests that pin the behaviour —
a `src/data/` file exporting `formatDistance` is a violation; the same file exporting `computeMetrics`
is not; the same export outside `src/data/` is not; a `format*` name appearing only in a comment or a
string is not.

The rule must be **proven non-vacuous by mutation**: break the pattern, watch a fixture test fail,
restore it, watch it pass. A gate that cannot fail is the defect this whole finding is about.

Expected after the change: **70 suites / 576 tests**, up from 69 / 571.

## Also fixed here

`docs/reviews/2026-09-10-full-review.md`'s Duplication dashboard row reads `0 / 1 / 9`; direct
enumeration gives `0 / 1 / 6` (DUP-1 should-fix, plus DUP-5, 6, 7, 9, 10, 11 minor). The drift dates
to `9a69856`, where DUP-8 closed without the count being decremented, and every later edit matched
the previous value rather than recounting. It is corrected here because this change edits the
dashboard's Architecture row two lines above, and leaving a known-false number in a document whose
stated rule is that it must never assert anything false would be incoherent.

## Out of scope

- The existing `format/units` import rule stays exactly as it is. The two rules catch different
  things and both are worth having.
- No formatter is moved, renamed or edited. DUP-11's naming and separator divergence stays open.
