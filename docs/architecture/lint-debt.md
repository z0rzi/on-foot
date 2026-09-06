# Lint debt — deferred React Compiler findings

When `expo lint` was first wired into the gate, it surfaced a set of **pre-existing**
`react-hooks` (React Compiler) findings in device-verified rendering code. Fixing them
correctly means changing render/effect behaviour that can only be validated **on-device**, so
they are **baselined to `warn`** in `eslint.config.js` (they do not block the gate) and
tracked here to be burned down deliberately — each fix TDD'd where the logic is pure, then
verified on a device per `AGENTS.md` and `POST-WORK.md`.

New violations of these rules in *new* code should still be fixed at the source, not added to
this list. This is a shrinking backlog, not a parking lot.

## `react-hooks/refs` and `react-hooks/immutability` — RESOLVED as false positives

The `refs` (ref access) and `immutability` (shared-value mutation) findings in `MapControls`
(`pan` gesture) and `RecordButton` (`hold` gesture) were **false positives**: every access is
inside a *deferred gesture callback* (`onBegin`/`onUpdate`/`onStart`/`onFinalize`) that runs at
gesture time, never during render — the compiler just can't see the deferral through the
`useMemo(() => Gesture…)` builder that the RNGH docs prescribe. Rewriting working, device-verified
drag/hold animation code to dodge a false positive would add risk for no behavioural gain, so
each gesture builder carries a scoped `eslint-disable` with a one-line justification instead
(`AGENTS.md`-sanctioned earned escape hatch). No behaviour change.

## `react-hooks/purity` — impure call during render

- `src/recording/useMovingStopwatch.ts:17` — `setNow(Date.now())` in the phase-change branch.
  Note this file was written deliberately (there is a design comment about never reading
  `Date.now()` inside render); the fix must preserve the paused/resumed stopwatch semantics
  and be **device-verified** with pause/resume, background, and app-restart cases.
