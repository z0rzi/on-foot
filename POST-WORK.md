# Post-Work Quality Control

Run this after finishing a unit of work (a task, feature, or fix), **before**
declaring it done or merging. Take a fresh, critical look at what *this iteration*
changed — not the whole codebase. Be honest and proportionate: report real issues,
don't manufacture them, and don't rubber-stamp.

First, read `AGENTS.md` — its "Architecture principles" are the standard you are
checking against. Then establish exactly what changed:

```
git diff --stat $(git merge-base HEAD master)..HEAD    # feature branch vs base
git diff                                                # uncommitted, if any
```
If the work landed directly on `master` (no feature branch), scope instead to the
commit range for this iteration, e.g. `git diff --stat HEAD~<n>..HEAD`.

Read every changed file in full (not just the diff hunks) so you judge each unit
in context.

## What to check

**1. Dead / unused code (highest-value pass — grep, don't eyeball)**
- State, props, exports, params, helpers, imports, types, tokens, or files that
  nothing reads. For each new export or piece of state, grep for its consumers;
  if the only hit is its own definition or its test, it's dead.
- Stubbed/scaffolded UI or options with no wiring (dead controls).
- Leftover debug logs, commented-out code, `TODO`/`FIXME`, temporary diagnostics.
- Anything built "for later" that isn't used now (YAGNI).

**2. Architecture & the inviolable seams**
- Are the seams intact? `npm run verify` runs the `seams` test, which enforces every entry in
  `src/architecture/seams.ts` (map SDK, DB engine, connectivity) — no manual greps needed.
- **New boundary introduced but not registered?** If this diff wraps a new native module or
  creates a new boundary directory, it must have a `SEAMS` entry — an unregistered boundary is
  a silent future leak that nothing will catch. See `docs/architecture/seams.md`.
- New provider/engine concepts declared on the port (semantic flags), never leaked
  as literals into shared store/UI code.
- Beware import side effects at the seam: a module barrel that constructs the
  singleton (e.g. `src/data/trails/index.ts` wiring `trailsRepository` →
  `openDatabaseSync`) *opens the DB on import*. Pure consumers therefore import
  types from the leaf (`src/data/trails/types`), not the barrel — only the
  composition point (the store) imports the barrel. Do NOT "unify" these imports
  through the barrel; that drags the engine + DB-open into pure UI and their unit
  tests. A barrel-vs-leaf split here is principled, not accidental.
- Did this change follow the patterns the codebase already uses for the same shape
  of problem, or fork a new one? Consistency beats preference.
- No quick-fixes or patches papering over a symptom — root cause fixed at the right
  layer, or the tension surfaced explicitly.
- **A wrapped native SDK/module's TypeScript types are NOT ground truth for runtime
  payloads.** When adapter code behind the seam wraps a native module, verify the actual
  shape against the installed platform source (`node_modules/<lib>/android|ios`) and handle
  per-platform differences. These mismatches pass `tsc` and `jest` (the native module is
  mocked) and surface only on device — e.g. a field the `.d.ts` types as a number that
  Android emits as a string, or a payload key named differently per platform.

**3. Cleanliness & maintainability**
- Small, single-purpose units with clear boundaries. Did any file take on a second
  responsibility or outgrow one clear job?
- Pure logic separated from impure edges (I/O, native, rendering). A folder of
  "pure, tested" modules shouldn't hide an I/O module.
- Layering: presentation logic (formatters, view helpers) shouldn't live in the
  data layer; the data layer shouldn't import UI.
- Consistent choices across the change: cache-update strategy, error handling,
  import style (barrel vs deep path), naming. Flag divergences between sibling
  functions.
- Names describe what things do; no confused or unused parameters in contracts.
- Error paths handled at the right layer (no swallowed errors, no promises left to
  reject unhandled, no state flags that can stick). `npm run verify`'s
  `no-floating-promises` catches the mechanical cases; you still judge whether a `void`ed
  promise should actually surface its failure to the user.
- No new `any`/`as any`/`@ts-ignore`/`eslint-disable` without a one-line justification of why
  it is necessary. Lint flags them (`no-explicit-any` warns); a reviewer decides if the escape
  hatch is earned or hiding a real type.
- **Derived or cached state that must track an authoritative source** (a registry, the DB,
  the network) has ONE owner that keeps it fresh — not a freshness convention repeated at
  each call site. Prefer structural invariants (a schema constraint, a single tagged field,
  a derived selector) over guards defended by hand in each action. Convention-based sync
  *will* drift.
- Icon-only interactive elements have an `accessibilityLabel` (route icon buttons through
  `ControlButton`, which requires it at compile time); text-bearing buttons are auto-labeled
  by React Native and need none.

**4. Failure & degraded modes**
- Enumerate the failure/degraded modes this change can hit — offline / network drop,
  permission denied, empty or malformed input, user cancel mid-operation — and confirm EACH
  has a handled outcome the user can see and recover from (feedback + a retry/cancel path),
  not a silent no-op, a stuck spinner, or a state flag that sticks.
- TDD the pure decisions here ("what needs retrying", "is this failed?"); device-verify the
  wiring **offline**, not just online.
- **Render crashes, not just async failures.** A thrown error in a component's render is
  caught by the root `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) into a recoverable
  fallback — confirm new risky render paths (parsing, indexing, non-null assumptions on async
  data) either can't throw or degrade gracefully rather than relying on the boundary as a
  catch-all.

**5. Persist the minimum**
- Only state that must survive a restart is persisted (Zustand `partialize`);
  session/UI state stays in memory.

**6. Tests & comments**
- Pure logic is TDD'd (`src/**/__tests__/`); tests assert real behavior, not mocks.
  Native rendering/gestures/DB round-trips are device-verified, not unit-tested.
- Comment style (AGENTS.md): no change-narrating comments; code self-documenting;
  comment only genuinely non-obvious *why*.

## Gates (run and confirm green)

```
npm run verify            # tsc (types) + jest (incl. seams/secrets/cycles) + expo lint
```
`verify` is the single gate — it also runs in the pre-push hook and CI, and must be green
(0 lint errors; warnings are tracked, see `docs/architecture/lint-debt.md`). For
Metro-transform / native / asset-import changes,
a passing `tsc`/`jest` is NOT enough — confirm a real bundle
(`npx expo export --platform android`) and, where behavior is native, device-verify.
Native rendering has traps that don't match a web/CSS mental model — e.g. on Android touch
events are clipped to a parent's layout bounds regardless of `overflow`; overlays, menus, and
gestures layered over a bottom sheet or the tab bar need on-device tap **and back-button**
verification.

## Report

Give a short honest verdict, then findings grouped by priority
(**must-fix → should-fix → minor/cosmetic → non-issues you checked**). For each:
file:line, what's wrong, why it matters, and the fix. Call out which are worth
doing now vs. deferring, and name anything that's a deliberate, defensible choice
so it isn't re-litigated later.

Structure the report around the six numbered checks above — for **each**, state what you
found or explicitly write "clean." A check with no line in the report was not done.

Then **stop and ask** before applying fixes — unless the finding is an unambiguous
cleanup (dead code, a stray debug log, a lint/type error), which you may fix
directly and note. Run the gates again after any fix.
