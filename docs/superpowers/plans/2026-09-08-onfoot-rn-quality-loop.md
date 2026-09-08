# Quality Loop Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 2026-09-07 health check's findings into gates and process steps so the next cleanup pass is small, and make the health check itself a repeatable, triggered procedure rather than an occasional big-bang.

**Architecture:** Three layers, matching what each failure mode needs. (1) A new `duplication` architecture test catches *verbatim* copies mechanically, following the seam/cycle precedent (a dependency-free Jest test over `collectSourceFiles()`). (2) A "name the sibling" step in the spec and in POST-WORK catches *renamed* copies, which no exact-match detector can see. (3) A `/health-check` command fixes the trigger, scope, doc format and mandatory close-out of a whole-repo pass, so each pass ends by adding gates rather than only fixing code.

**Tech Stack:** TypeScript ~6.0.3, Jest 29 via jest-expo, Node `fs`/`path` (already enabled for architecture tests), Markdown docs. No new dependencies.

## Global Constraints

- **No new npm dependency for the gate.** Precedent: `madge` was rejected for cycle detection (peer range excludes TS 6) and `cycles.test.ts` was written instead. The duplication detector follows the same pattern.
- **Architecture tests live in `src/architecture/`** as a pure module plus a test in `src/architecture/__tests__/`, and run inside `npm run verify` without changing the `verify` script.
- **Facts have no discretionary escape.** The duplication test is a fact-style gate like seams/cycles. Its only escape is a registered exemption with a rationale, mirroring `SEAMS[].allow`.
- **Comment policy (AGENTS.md):** describe current state, never the change. A module-level *why* comment is fine; change narration is not.
- **Commit style:** `type(scope): lowercase imperative sentence`, no body. Examples in `git log`: `refactor(data): drop the row casts at the persistence seam so schema drift is a type error`.
- **`npm run verify` must be green** after every task.
- **Calibration facts** (measured 2026-09-08, window = 8 significant lines): this branch reports **0** blocks; `master` before the health check reports **5** (trail/activity list items, both `mapping.ts` insert shapes, the two `MapCanvas` fit effects, the `PausedControls`/`RecordButton` control style). The identical-modulo-identifier selection hooks are **not** caught at any window size, which is why Task 2 exists.

**Before starting:** land the `health-check-2026-09` branch on `master` (or branch this work from it). Every task below assumes that tree.

---

### Task 1: Verbatim-duplication gate

**Files:**
- Create: `src/architecture/duplication.ts`
- Create: `src/architecture/__tests__/duplication.test.ts`
- Modify: `AGENTS.md` (the "Hold the type and quality line" and "A check enforces a *response*" bullets)
- Modify: `POST-WORK.md` (check 2 gate line and the "Gates" block)
- Modify: `docs/architecture/seams.md` (one paragraph pointing at the new test, next to the seams test description)

**Interfaces:**
- Consumes: `collectSourceFiles()` and `SourceFile` from `src/architecture/sourceScan.ts` (existing).
- Produces: `findDuplicateBlocks(files: SourceFile[], window?: number, exempt?: DuplicateExemption[]): DuplicateBlock[]`, `significantLines(content: string): SignificantLine[]`, `DUPLICATION_WINDOW = 8`, `DUPLICATION_EXEMPT: DuplicateExemption[]`.

- [ ] **Step 1: Write the failing tests**

`src/architecture/__tests__/duplication.test.ts`:

```ts
import { DUPLICATION_EXEMPT, DUPLICATION_WINDOW, findDuplicateBlocks, significantLines } from '../duplication'
import { collectSourceFiles } from '../sourceScan'

const block = (n: number, line: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => line(i)).join('\n')

const tenLines = block(10, (i) => `const value${i} = compute(${i}, input)`)

describe('verbatim duplication', () => {
  test('the source tree has no verbatim block of DUPLICATION_WINDOW significant lines or more', () => {
    const blocks = findDuplicateBlocks(collectSourceFiles(), DUPLICATION_WINDOW, DUPLICATION_EXEMPT)
    const report = blocks
      .map(
        (b) =>
          `  ${b.a.file}:${b.a.startLine}-${b.a.endLine} <-> ${b.b.file}:${b.b.startLine}-${b.b.endLine} (${b.lines} significant lines)`,
      )
      .join('\n')
    expect(blocks.length === 0 ? '' : `\nVerbatim duplicates (extract the shared shape or register an exemption):\n${report}\n`).toBe('')
  })

  test('reports two files that share a verbatim block', () => {
    const files = [
      { path: 'src/a.ts', content: tenLines },
      { path: 'src/b.ts', content: tenLines },
    ]
    const blocks = findDuplicateBlocks(files, 8, [])
    expect(blocks).toEqual([
      { a: { file: 'src/a.ts', startLine: 1, endLine: 10 }, b: { file: 'src/b.ts', startLine: 1, endLine: 10 }, lines: 10 },
    ])
  })

  test('ignores a shared block shorter than the window', () => {
    const seven = block(7, (i) => `const value${i} = compute(${i}, input)`)
    const files = [
      { path: 'src/a.ts', content: seven },
      { path: 'src/b.ts', content: seven },
    ]
    expect(findDuplicateBlocks(files, 8, [])).toHaveLength(0)
  })

  test('blank lines, comments, imports and punctuation-only lines do not count', () => {
    const padding = [
      "import { x } from './x'",
      "export { y } from './y'",
      '',
      '// a comment',
      '/* block',
      ' * comment */',
      '{',
      '}',
      '),',
      '];',
    ].join('\n')
    const files = [
      { path: 'src/a.ts', content: `${padding}\nconst one = 1\nconst two = 2` },
      { path: 'src/b.ts', content: `${padding}\nconst one = 1\nconst two = 2` },
    ]
    expect(significantLines(files[0].content)).toEqual([
      { line: 11, text: 'const one = 1' },
      { line: 12, text: 'const two = 2' },
    ])
    expect(findDuplicateBlocks(files, 2, [])).toHaveLength(1)
    expect(findDuplicateBlocks(files, 3, [])).toHaveLength(0)
  })

  test('reports a block repeated within one file, but never a window against itself', () => {
    const files = [{ path: 'src/a.ts', content: `${tenLines}\nconst gap = 0\n${tenLines}` }]
    const blocks = findDuplicateBlocks(files, 8, [])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ a: { startLine: 1, endLine: 10 }, b: { startLine: 12, endLine: 21 }, lines: 10 })
  })

  test('honours an exemption prefix', () => {
    const files = [
      { path: 'src/assets/icons/a.tsx', content: tenLines },
      { path: 'src/assets/icons/b.tsx', content: tenLines },
    ]
    expect(findDuplicateBlocks(files, 8, [{ path: 'src/assets/icons/', rationale: 'test' }])).toHaveLength(0)
    expect(findDuplicateBlocks(files, 8, [])).toHaveLength(1)
  })

  test('cannot see a copy that renames its identifiers (that is the spec sibling step, not this gate)', () => {
    const files = [
      { path: 'src/trail.ts', content: block(10, (i) => `const trail${i} = loadTrail(${i})`) },
      { path: 'src/activity.ts', content: block(10, (i) => `const activity${i} = loadActivity(${i})`) },
    ]
    expect(findDuplicateBlocks(files, 8, [])).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/architecture/__tests__/duplication.test.ts`
Expected: FAIL with `Cannot find module '../duplication'`.

- [ ] **Step 3: Write the detector**

`src/architecture/duplication.ts`:

```ts
import { SourceFile } from './sourceScan'

// Reports runs of identical *significant* lines (blank, comment, import and punctuation-only
// lines do not count) of at least DUPLICATION_WINDOW, across files or within one. Identifiers
// are not normalised on purpose: a copy that renames every symbol (trail -> activity) is
// invisible here and is caught by the spec's "Existing shape" step and POST-WORK's sibling
// check instead. Window calibration: 8 reports nothing on the post-health-check tree and five
// of the 2026-09-07 findings on the tree before it.
export const DUPLICATION_WINDOW = 8

export interface DuplicateExemption {
  path: string
  rationale: string
}

export const DUPLICATION_EXEMPT: DuplicateExemption[] = []

export interface CodeLocation {
  file: string
  startLine: number
  endLine: number
}

export interface DuplicateBlock {
  a: CodeLocation
  b: CodeLocation
  lines: number
}

export interface SignificantLine {
  line: number
  text: string
}

const PUNCTUATION_ONLY = /^[\s{}()[\];,]*$/
const COMMENT = /^(\/\/|\/\*|\*)/
const IMPORT_OR_REEXPORT = /^(import\b|export\s.*\sfrom\s)/

export function significantLines(content: string): SignificantLine[] {
  const out: SignificantLine[] = []
  content.split('\n').forEach((raw, index) => {
    const text = raw.trim()
    if (!text || PUNCTUATION_ONLY.test(text) || COMMENT.test(text) || IMPORT_OR_REEXPORT.test(text)) return
    out.push({ line: index + 1, text })
  })
  return out
}

interface Occurrence {
  file: string
  index: number
  lines: SignificantLine[]
}

interface Run {
  a: Occurrence
  b: Occurrence
  length: number
}

const location = (o: Occurrence, length: number): CodeLocation => ({
  file: o.file,
  startLine: o.lines[o.index].line,
  endLine: o.lines[o.index + length - 1].line,
})

const compareLocations = (x: CodeLocation, y: CodeLocation): number =>
  x.file.localeCompare(y.file) || x.startLine - y.startLine

export function findDuplicateBlocks(
  files: SourceFile[],
  window: number = DUPLICATION_WINDOW,
  exempt: DuplicateExemption[] = DUPLICATION_EXEMPT,
): DuplicateBlock[] {
  const byKey = new Map<string, Occurrence[]>()
  for (const file of files) {
    if (exempt.some((e) => file.path.startsWith(e.path))) continue
    const lines = significantLines(file.content)
    for (let index = 0; index + window <= lines.length; index++) {
      const key = lines
        .slice(index, index + window)
        .map((l) => l.text)
        .join('\n')
      const list = byKey.get(key) ?? []
      list.push({ file: file.path, index, lines })
      byKey.set(key, list)
    }
  }

  const pairsByFiles = new Map<string, [Occurrence, Occurrence][]>()
  for (const occurrences of byKey.values()) {
    if (occurrences.length < 2) continue
    for (let x = 0; x < occurrences.length; x++) {
      for (let y = x + 1; y < occurrences.length; y++) {
        const a = occurrences[x]
        const b = occurrences[y]
        if (a.file === b.file && Math.abs(a.index - b.index) < window) continue
        const key = `${a.file} ${b.file}`
        const list = pairsByFiles.get(key) ?? []
        list.push([a, b])
        pairsByFiles.set(key, list)
      }
    }
  }

  const blocks: DuplicateBlock[] = []
  for (const pairs of pairsByFiles.values()) {
    pairs.sort((p, q) => p[0].index - q[0].index || p[1].index - q[1].index)
    let run: Run | null = null
    for (const [a, b] of pairs) {
      if (
        run !== null &&
        a.index === run.a.index + run.length - window + 1 &&
        b.index === run.b.index + run.length - window + 1
      ) {
        run.length++
      } else {
        if (run !== null) blocks.push({ a: location(run.a, run.length), b: location(run.b, run.length), lines: run.length })
        run = { a, b, length: window }
      }
    }
    if (run !== null) blocks.push({ a: location(run.a, run.length), b: location(run.b, run.length), lines: run.length })
  }

  return blocks.sort((x, y) => compareLocations(x.a, y.a) || compareLocations(x.b, y.b))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/architecture/__tests__/duplication.test.ts`
Expected: PASS, 7 tests. If the whole-tree test reports a block, the tree has drifted since calibration: extract the shared shape (never register an exemption for production code just to go green).

- [ ] **Step 5: Mutation-check the gate against a real copy**

Run:

```bash
cp src/components/EntityListItem.tsx src/components/__mutation_copy.tsx
npx jest src/architecture/__tests__/duplication.test.ts -t 'source tree'
rm src/components/__mutation_copy.tsx
```

Expected: the middle command FAILS and the report names `src/components/EntityListItem.tsx` against `src/components/__mutation_copy.tsx`. After the `rm`, the test passes again. (`useSelectedTrail.ts` is not a usable fixture: since the health check it is a four-line wrapper, below the window.)

- [ ] **Step 6: Wire the gate into the docs that list the gates**

`AGENTS.md`, "Hold the type and quality line" bullet, change

```
  without a one-line justification of why it is necessary. `npm run verify` (types, tests,
  seams/secrets/cycles, lint) must be green before a change is done — it runs in the pre-push
```

to

```
  without a one-line justification of why it is necessary. `npm run verify` (types, tests,
  seams/secrets/cycles/duplication, lint) must be green before a change is done — it runs in the pre-push
```

`AGENTS.md`, "A check enforces a *response*" bullet, change

```
  *honest* justification, it is a real finding: fix it at the source. (Facts — type errors, test
  failures, the seam/secret/cycle tests — are not heuristics and have no discretionary escape.)
```

to

```
  *honest* justification, it is a real finding: fix it at the source. (Facts — type errors, test
  failures, the seam/secret/cycle/duplication tests — are not heuristics and have no discretionary
  escape; the duplication test's only escape is a `DUPLICATION_EXEMPT` entry with a rationale.)
```

`POST-WORK.md`, check 2, change

```
- Are the seams intact? `npm run verify` runs the `seams` test, which enforces every entry in
  `src/architecture/seams.ts` (map SDK, DB engine, connectivity) — no manual greps needed.
```

to

```
- Are the seams intact? `npm run verify` runs the `seams` test, which enforces every entry in
  `src/architecture/seams.ts` (map SDK, DB engine, connectivity) — no manual greps needed.
- Is anything a verbatim copy? `npm run verify` runs the `duplication` test
  (`src/architecture/duplication.ts`), which fails on any run of 8+ identical significant lines.
  It cannot see a copy that renames its identifiers — that is check 3's sibling bullet.
```

`POST-WORK.md`, "Gates" block, change

```
npm run verify            # tsc (types) + jest (incl. seams/secrets/cycles) + expo lint
```
`verify` is the single gate — it also runs in the pre-push hook and CI, and must be green
(0 lint errors; warnings are tracked, see `docs/architecture/lint-debt.md`). For
```

to

```
npm run verify            # tsc (types) + jest (incl. seams/secrets/cycles/duplication) + expo lint
```
`verify` is the single gate — it also runs in the pre-push hook and CI, and must be green
(0 lint errors and 0 warnings; the standing justified disables are listed in
`docs/architecture/lint-debt.md`). For
```

`docs/architecture/seams.md`, after the paragraph that starts "The `seams` Jest test", add:

```
Two sibling gates use the same scan: `importRules.ts` (one-way directory bans that are not
native seams) and `duplication.ts` (verbatim copies of 8+ significant lines, across or within
files). Both fail `npm run verify` with a report naming the files; the only escape is a
registered entry with a rationale, never an inline disable.
```

- [ ] **Step 7: Run the full gate**

Run: `npm run verify`
Expected: tsc clean, 50 suites pass (49 + `duplication`), lint 0/0.

- [ ] **Step 8: Commit**

```bash
git add src/architecture/duplication.ts src/architecture/__tests__/duplication.test.ts AGENTS.md POST-WORK.md docs/architecture/seams.md
git commit -m "chore(architecture): fail verify on verbatim copies of eight or more significant lines"
```

---

### Task 2: "Name the sibling" before the second copy exists

**Files:**
- Modify: `AGENTS.md` ("Respect existing patterns" bullet and "Features go through brainstorm → spec → plan" bullet)
- Modify: `POST-WORK.md` (check 3)

**Interfaces:**
- Consumes: nothing.
- Produces: the section heading `## Existing shape` that every later spec must carry when the feature is a second instance of a shape, and that the `/health-check` command (Task 3) audits.

- [ ] **Step 1: Extend the "Respect existing patterns" principle**

`AGENTS.md`, change

```
- **Respect existing patterns.** Before adding code, find how the codebase already solves
  the same shape of problem and follow it. Consistency beats personal preference. If a
  pattern genuinely needs to change, change it deliberately and everywhere — don't fork it.
```

to

```
- **Respect existing patterns.** Before adding code, find how the codebase already solves
  the same shape of problem and follow it. Consistency beats personal preference. If a
  pattern genuinely needs to change, change it deliberately and everywhere — don't fork it.
  **The second instance of a shape is the moment duplication is born**: a second entity with
  its own list, form, badge, sheet or selection hook. Before writing it, name the first
  instance and extract what is shared (`EntityListItem`, `EnumBadge`, `useSelectedEntity` are
  the results of doing this late). A copy that renames every identifier passes every
  mechanical gate, so this is a design step, not a lint.
```

- [ ] **Step 2: Require the section in specs**

`AGENTS.md`, change

```
- **Features go through brainstorm → spec → plan** (`docs/superpowers/`), not
  straight-to-code. Small changes still get a design thought through before implementation.
```

to

```
- **Features go through brainstorm → spec → plan** (`docs/superpowers/`), not
  straight-to-code. Small changes still get a design thought through before implementation.
  Every spec carries an **`## Existing shape`** section: the closest existing feature of the
  same shape (or "none"), what will be reused from it, and what is extracted to be shared.
  "Nothing to share" is an acceptable answer only with the reason.
```

- [ ] **Step 3: Add the sibling bullet to POST-WORK check 3**

`POST-WORK.md`, in "**3. Cleanliness & maintainability**", after the bullet that starts "Consistent choices across the change", add:

```
- **Every new file has a named sibling.** For each file this diff creates, name the existing
  file with the same role (a second `XListItem`, `XForm`, `XBadge`, `useSelectedX`, `XSheet`)
  and state whether the shared shape was reused or extracted. The `duplication` gate catches
  only verbatim copies; a copy that renames its identifiers is caught here or not at all.
```

- [ ] **Step 4: Run the gate and commit**

Run: `npm run verify`
Expected: green (docs-only change).

```bash
git add AGENTS.md POST-WORK.md
git commit -m "docs: require naming the existing sibling before a second instance of a shape is written"
```

---

### Task 3: `/health-check` command with a trigger, a scope and a mandatory close-out

**Files:**
- Create: `.claude/commands/health-check.md`
- Modify: `docs/architecture/health-check-2026-09-07.md` (append a "Gates added" section so the existing doc matches the new format)

**Interfaces:**
- Consumes: the `## Existing shape` heading from Task 2; the `DUPLICATION_EXEMPT`, `SEAMS` and `IMPORT_RULES` registries as the places findings turn into gates.
- Produces: the dated doc format `docs/architecture/health-check-YYYY-MM-DD.md` with a required `## Gates added` section.

- [ ] **Step 1: Write the command**

`.claude/commands/health-check.md`:

```markdown
---
description: Whole-codebase health check — triggered, scoped, and closed out by adding gates
---

# Health-Check — whole-codebase review

A whole-repo pass, not tied to one feature. It exists because the per-iteration checks
(`/retro-quality`, `POST-WORK.md`) are scoped to a diff and cannot see a copy of a file they
never opened. Run it on a trigger, keep it small, and end it by turning findings into gates.

## When to run

Run when **any** of these is true — do not wait for "a while":

- A merged feature added a **second instance of a shape** (a new entity type, a second
  list/form/sheet/selection hook). This is where duplication is born.
- **Three features** have merged since the last `docs/architecture/health-check-*.md`.
- A release or tag is imminent.
- The owner asks.

## Before reading code

1. Read `AGENTS.md` and the **latest** `docs/architecture/health-check-*.md` in full, including
   its "Gates added" and "recorded-not-done" items. Do not re-derive what it already settled.
2. Run `npm run verify` and record the baseline (suites, tests, lint counts).
3. List specs merged since the last check and confirm each has an `## Existing shape` section.
   A missing one is a finding in its own right.

## What to read

Read directory by directory, every production file in full, in this order:
`src/architecture`, `src/data`, `src/store`, `src/map`, `src/recording`, `src/elevation`,
`src/trails`, `src/activities`, `src/components`, `src/theme`, `src/settings`, `app/`.
For each, look for exactly these, and nothing speculative:

- **Parametric duplication** the `duplication` gate cannot see: two files that differ only by
  identifier (`diff` them; if the diff is names, it is a copy).
- **Pure decision logic inside a `.tsx`** (a mapping, a plan, a threshold) that has no test
  because the TDD rule stops at the file boundary. Move it to a `.ts` beside its feature.
- **Escapes without justification**: `eslint-disable`, `as any`, `@ts-ignore`, a cast at a
  seam that suppresses rather than bridges.
- **Native modules used from more than one place** that are not yet seams
  (`docs/architecture/seams.md` "Candidates").
- **Dead exports**: for every export, grep for a consumer outside its own file and test.
- **Forked patterns** between siblings (one memoizes, the other does not; one derives during
  render, the other sets state in an effect).

## Device walk-through

After the code pass, walk every screen on a device in **both** themes, with the keyboard, and
offline: trails list → trail sheet → edit → frame route (from 3D) → record → pause → resume →
save → activities list → activity sheet → offline chooser → download → settings. Note anything
wrong. The last two checks found four real bugs here that no unit test could reach.

## The document

Write `docs/architecture/health-check-YYYY-MM-DD.md`, in the shape of the previous one:
baseline, one-paragraph shape of the findings, numbered sections with `file:line` anchors and
the `AGENTS.md` principle each bears on, a suggested order.

Rules for findings, learned the hard way:

- **Trace the consumers before calling something a defect.** A conflict read from two files in
  isolation is often not one (the smoothing "double truth" was not).
- **Read the platform's real type or payload before calling an adapter redundant.**
- **A fix is proven by a test that fails before and passes after**, not by the diff reading well.
- Mark a section resolved only with that evidence, and never write "all resolved" while an
  item is open.

## Close-out (mandatory)

The document ends with a **`## Gates added`** section. For every finding, one line saying which
of these it became:

- a **mechanical gate** — a `SEAMS` entry, an `IMPORT_RULES` entry, a `DUPLICATION_EXEMPT`
  entry with rationale, a new architecture test, or a unit test;
- a **process step** — a one-line addition to `AGENTS.md` or `POST-WORK.md` (rarely; every
  added line dilutes the rest);
- **recorded-not-done**, with the reason and what would trigger doing it.

A finding that became none of these is the next check's finding again. Then run
`/retro-quality` on the check's own diff and `/if-from-zero` on any abstraction it introduced.
```

- [ ] **Step 2: Bring the existing check into the new format**

Append to `docs/architecture/health-check-2026-09-07.md`, after the "All sections resolved" paragraph:

```markdown
## Gates added

Retrofitted 2026-09-08 when the `/health-check` command was written; these are the findings
above that became something that runs on every push.

| Finding | Became |
|---|---|
| §1 verbatim copies (list items, mapping insert shapes, fit effects, control style) | `duplication` architecture test (`src/architecture/duplication.ts`) |
| §1 renamed copies (the two selection hooks) | `## Existing shape` spec section + POST-WORK sibling bullet (process) |
| §5 preference must not reach stored metrics | `IMPORT_RULES` entry (`src/data/` → `settings/preferencesStore`) |
| §7 row casts hid schema drift | removed; `tsc` is now the gate |
| §4 recording rollback | `recordingController.test.ts` failure-path tests |
| §9 `onControlAccent` | theme test locks the token |
| §8 dead `ended_at` column, §8 seam candidates | recorded-not-done: needs a migration / device-verified refactors |
```

- [ ] **Step 3: Run the gate and commit**

Run: `npm run verify`
Expected: green.

```bash
git add .claude/commands/health-check.md docs/architecture/health-check-2026-09-07.md
git commit -m "docs: add the health-check command with its triggers and a mandatory gates-added close-out"
```

---

### Task 4: Promote the generalisable lessons into AGENTS.md

**Files:**
- Modify: `AGENTS.md` (one new bullet under "Architecture principles", before "Features go through brainstorm")

**Interfaces:** none.

- [ ] **Step 1: Add the bullet**

`AGENTS.md`, insert before the "Features go through brainstorm → spec → plan" bullet:

```
- **Reviewing is evidence-driven.** Trace a finding to its consumers before calling it a
  defect. Read the platform's actual type or runtime payload before calling an adapter
  redundant. Prove a fix with a test that fails before it and passes after. Fixing a hot path
  or extracting a helper is not a licence to stop reading the surrounding code, and never
  codify accidental drift into a shared API.
```

Do not add more. The health-check docs keep the full stories; `AGENTS.md` keeps one line per
lesson, and only lessons that apply to every session.

- [ ] **Step 2: Run the gate and commit**

Run: `npm run verify`
Expected: green.

```bash
git add AGENTS.md
git commit -m "docs: state the evidence rules for reviews that the health check learned"
```

---

### Task 5: Drop the unused test-rendering dependency

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `docs/architecture/health-check-2026-09-07.md` (§2, last paragraph)

**Interfaces:** none.

- [ ] **Step 1: Confirm it is unused**

Run: `grep -rn 'testing-library' src app jest.setup.js babel.config.js`
Expected: no output. If there is output, stop: the finding is stale and this task is void.

- [ ] **Step 2: Remove it**

Run: `npm uninstall @testing-library/react-native`
Expected: `package.json` devDependencies no longer list it; lockfile updated.

- [ ] **Step 3: Update the record**

`docs/architecture/health-check-2026-09-07.md`, change

```
`@testing-library/react-native` is still an unused devDependency; dropping it is a one-line
`package.json` change left for a dependency pass rather than bundled here.
```

to

```
`@testing-library/react-native` was an unused devDependency; removed 2026-09-08.
```

- [ ] **Step 4: Run the gate and commit**

Run: `npm run verify`
Expected: green, same test count as before.

```bash
git add package.json package-lock.json docs/architecture/health-check-2026-09-07.md
git commit -m "chore: drop the unused react-native testing library"
```

---

## Cadence after this plan

- Per feature: brainstorm with `## Existing shape` → spec → plan → implement → `/retro-quality` → `/if-from-zero` → merge. The `duplication` gate runs on every push.
- `/health-check` on its triggers (second instance of a shape, three merged features, release). Each one ends with `## Gates added`, so the next pass is smaller than the last.
- Recorded-not-done items carry forward in the health-check docs, not in anyone's memory.
