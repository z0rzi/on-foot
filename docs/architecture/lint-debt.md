# Lint policy — React Compiler & type rules

This started as a warn-baselined backlog of pre-existing `react-hooks` (React Compiler) findings.
That backlog is **burned down and the rules are now enforced as `error`** (see `eslint.config.js`).
`npm run verify` / the pre-push hook now runs at **0 warnings, 0 errors** — there is no ambient
yellow to train the gate to be ignored.

## Principle

A lint rule is a **heuristic**, not an oracle. Enforcing at `error` does not claim the rule is
always right (`react-hooks/exhaustive-deps` has legitimate deliberate exceptions); it claims you
must **consciously respond**. Two responses are valid: fix the code, or an inline `eslint-disable`
with a one-line justification. A justified disable is a first-class outcome — **never reshape
correct, clear code just to satisfy a rule.** If you can't write an honest justification, it's a
real finding: fix it. `reportUnusedDisableDirectives: error` keeps the disables honest — one that
stops suppressing anything (e.g. the compiler fixes its false positive) errors, so they can't rot.

Facts (type errors, test failures, the seam/secret/cycle tests) are not heuristics and have no
discretionary escape. See the "A check enforces a response, not an outcome" principle in `AGENTS.md`.

## What was fixed (real findings)

- **`exhaustive-deps`** — dishonest dep arrays made honest by memoizing the callbacks the effect/memo
  actually used (`app/activity/save.tsx`, `src/elevation/ElevationGraph.tsx`).
- **`set-state-in-effect`** — selected/linked trail/activity now **derived during render** (keyed to
  the id it loaded) instead of cleared with a `setState` in an effect
  (`useSelectedTrail`, `useSelectedActivity`, `ActivityInfoSheet`).
- **`no-explicit-any` / `no-unused-expressions`** — real fixes where a proper type or statement was
  clearer (`provider/types.ts` `isValidCapabilities` → `unknown`, `MapViewProps.style` →
  `StyleProp<ViewStyle>`; `LayersSheet` ref cast; `OfflineLayerChooser` ternary → `if/else`).

## Standing inline exceptions (justified disables)

- **`react-hooks/refs` + `react-hooks/immutability`** in `src/map/MapControls.tsx` (`pan`) and
  `src/map/RecordButton.tsx` (`hold`) — **false positives**: every access is inside a deferred
  gesture callback (runs at gesture time, never during render), which the compiler can't see through
  the `useMemo(() => Gesture…)` builder the RNGH docs prescribe. Rewriting working, device-verified
  animation code to dodge a false positive would add risk for no gain.
- **`react-hooks/purity`** in `src/recording/useMovingStopwatch.ts` — **deliberate**: reads the
  wall-clock instant synchronously on resume so the first frame reflects the accumulated pause;
  without it the timer jumps back by the pause duration for one frame. Every local alternative only
  moves the finding; the only warning-free version is a data-model refactor (a resume timestamp on
  the session) not worth doing to satisfy a rule that can't model "I need the current time here."
- **`@typescript-eslint/no-explicit-any`** in `src/data/trails/gpx/parse.ts` — the `fast-xml-parser`
  boundary emits untyped nodes; leaf values are validated by `num()`/`str()`, so typing the tree
  rigorously would add casts without adding safety.

## Scoped relaxations

In **test files** `@typescript-eslint/no-explicit-any` and `import/first` are `off` (not `warn`):
`any` is the norm for mocks/partial fixtures, and `import/first` fights the mock-before-import
ordering tests legitimately need. A rule that isn't trustworthy in a context should be silent there,
not noisy.
