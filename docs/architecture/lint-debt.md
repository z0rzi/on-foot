# Lint debt — React Compiler findings

When `expo lint` was first wired into the gate, it surfaced a set of **pre-existing**
`react-hooks` (React Compiler) findings. They were **baselined to `warn`** in `eslint.config.js`
(they do not block the gate) and tracked here to be burned down deliberately — real behavioural
fixes TDD'd where the logic is pure and verified on-device per `AGENTS.md` / `POST-WORK.md`.

**Burn-down done.** The `exhaustive-deps` and `set-state-in-effect` findings were genuine and are
fixed (honest deps via memoized callbacks; selected/linked trail derived during render instead of
cleared in an effect). The `refs`/`immutability` findings were **false positives** on idiomatic
gesture code (resolved with justified inline disables). The one `purity` finding is a **deliberate
exception** — see below. What remains is not this backlog: a separate, untracked set of non-render
warnings (`@typescript-eslint/no-explicit-any`, `import/first`, `no-unused-expressions`) that are
their own small cleanups if ever worth doing.

The lesson worth keeping: green ≠ clean. These rules earned real improvements in the honest middle
(dishonest deps, cascading effects) and were simply wrong at the edges (correct gesture code, a
deliberately-synchronous clock read). Fix what the rule is right about; document what it is wrong
about. Don't refactor working code to satisfy a tool's blind spot.

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

## `react-hooks/purity` — ACCEPTED as a deliberate exception

- `src/recording/useMovingStopwatch.ts:17` — `setNow(Date.now())` on the transition into
  recording. This reads the wall-clock instant *synchronously* on resume so the first frame
  already reflects the accumulated pause; without it the timer jumps backward by the pause
  duration for one frame. Every local alternative only moves the finding (a layout effect trades
  `purity` for `set-state-in-effect`), and the only warning-free version is a data-model refactor
  (plumbing a resume timestamp through the session/store) — not worth it to satisfy a rule that
  can't model "I need the current time synchronously here." Left as a documented, intentional
  impurity. Revisit only if the recording session gains a resume timestamp for other reasons.
