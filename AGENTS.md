# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Architecture principles

This project is **entirely AI-written**. Its long-term value depends on staying
architecturally coherent across many sessions by different agents. Guard against drift:
uphold the original design, do not let it erode one expedient change at a time.

- **No quick-fixes or patches.** Fix the root cause, at the right layer. If the clean fix
  is bigger than the symptom, do the clean fix (or stop and flag it) — never paper over it.
  A workaround that "just makes it work" is a defect, not a solution.
- **Respect existing patterns.** Before adding code, find how the codebase already solves
  the same shape of problem and follow it. Consistency beats personal preference. If a
  pattern genuinely needs to change, change it deliberately and everywhere — don't fork it.
- **The map-provider seam is inviolable.** Only `src/map/providers/<provider>/` may import a
  map SDK (`@rnmapbox/maps` today). The store, UI, and shared map code stay
  provider-agnostic and talk to the semantic provider port (`src/map/provider/`). New
  provider-specific concepts are declared on the port (e.g. semantic flags on descriptors),
  never leaked as literals into shared code. MapLibre is the intended escape hatch — keep it
  reachable.
- **Keep units small and single-purpose,** communicating through well-defined interfaces.
  Split by responsibility, not by layer. A file that outgrows one clear job is a signal to
  decompose, not to keep piling on.
- **Pure logic is TDD'd; native rendering is device-verified.** State machines, resolution
  helpers, theme/capability logic → Jest tests written first (`src/**/__tests__/`). Map
  rendering, gestures, and camera behaviour are verified on-device, not unit-tested.
- **Persist the minimum.** Only state that must survive a restart is persisted (Zustand
  `partialize`); session/UI state stays in-memory.
- **Features go through brainstorm → spec → plan** (`docs/superpowers/`), not
  straight-to-code. Small changes still get a design thought through before implementation.

When a request tempts you toward a shortcut that violates the above, surface the tension
instead of silently taking the shortcut.

# About comments

Refrain from over-commenting. Don't describe changes in comments, just describe the current state of the code.

DON'T:
```
const d1 = new Date();

// Here we pass d1 because the Date constructor could have a few ms of difference
// between the two calls.
const d2 = new Date(d1.getTime());
```
Here, we clearly explain a fix. Refrain from doing it.

DO:
```
const d1 = new Date();
const d2 = new Date(d1.getTime());
```
No comments needed in that case, the code is self-documenting.
