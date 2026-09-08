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
