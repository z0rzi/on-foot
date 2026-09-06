# Lint debt — deferred React Compiler findings

When `expo lint` was first wired into the gate, it surfaced a set of **pre-existing**
`react-hooks` (React Compiler) findings in device-verified rendering code. Fixing them
correctly means changing render/effect behaviour that can only be validated **on-device**, so
they are **baselined to `warn`** in `eslint.config.js` (they do not block the gate) and
tracked here to be burned down deliberately — each fix TDD'd where the logic is pure, then
verified on a device per `AGENTS.md` and `POST-WORK.md`.

New violations of these rules in *new* code should still be fixed at the source, not added to
this list. This is a shrinking backlog, not a parking lot.

## `react-hooks/set-state-in-effect` — setState synchronously inside an effect

Cascading renders. Usually fixed by deriving the value during render, or gating the
`setState` behind the async result rather than calling it unconditionally in the effect body.

- `src/map/useSelectedTrail.ts:15` — `setTrail(null)` in the effect when there is no selection.
- `src/map/useSelectedActivity.ts:15` — `setActivity(null)`, same shape.
- `src/map/ActivityInfoSheet.tsx:29` — `setLinkedTrail(null)` when the activity has no linked trail.

*Likely fix:* derive the "no selection / no link" state from the current props/store during
render instead of writing it back with `setState`, so the effect only runs for the async load.

## `react-hooks/refs` — accessing a ref during render

Reading `ref.current` during render is unstable. Move the access into an event handler,
effect, or imperative callback.

- `src/map/MapControls.tsx:70`, `74`
- `src/map/RecordButton.tsx:77`, `80`

## `react-hooks/immutability` — mutating a value that must not be modified

- `src/map/RecordButton.tsx:74`, `75`, `81`, `82` — a value the compiler considers immutable
  is being mutated during render.

## `react-hooks/purity` — impure call during render

- `src/recording/useMovingStopwatch.ts:17` — `setNow(Date.now())` in the phase-change branch.
  Note this file was written deliberately (there is a design comment about never reading
  `Date.now()` inside render); the fix must preserve the paused/resumed stopwatch semantics
  and be **device-verified** with pause/resume, background, and app-restart cases.
