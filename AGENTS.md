# Expo HAS CHANGED

Read the exact versioned docs for the Expo SDK version pinned in `package.json` (the `expo`
dependency) before writing any code — e.g. SDK 57 → https://docs.expo.dev/versions/v57.0.0/.
`/deps-check` flags when this pin drifts from `package.json`.

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
  **The second instance of a shape is the moment duplication is born**: a second entity with
  its own list, form, badge, sheet or selection hook. Before writing it, name the first
  instance and extract what is shared (`EntityListItem`, `EnumBadge`, `useSelectedEntity` are
  the results of doing this late). A copy that renames every identifier passes every
  mechanical gate, so this is a design step, not a lint.
- **Architectural seams are inviolable and declared in `src/architecture/seams.ts`.** A seam
  confines a native SDK/engine to one directory so the rest of the app stays provider-agnostic
  and swappable. Today: the **map SDK** (`@rnmapbox/maps` → `src/map/providers/<provider>/`;
  shared code talks to the semantic port `src/map/provider/`, and MapLibre is the intended
  escape hatch — keep it reachable), the **database engine** (`expo-sqlite`/`drizzle-orm` →
  `src/data/db/`), **connectivity** (`@react-native-community/netinfo` → `src/net/`), and
  **location** (`expo-location`/`expo-task-manager` → `src/location/`; recording and map code
  use the location port, never the SDK).
  Provider-specific concepts are declared on the port (e.g. semantic flags on descriptors),
  never leaked as literals into shared code. When a change introduces a new boundary (a
  native-SDK wrapper, a new port), register it in `seams.ts` in the same change — the `seams`
  test enforces every entry. See `docs/architecture/seams.md`.
- **Keep units small and single-purpose,** communicating through well-defined interfaces.
  Split by responsibility, not by layer. A file that outgrows one clear job is a signal to
  decompose, not to keep piling on.
- **Pure logic is TDD'd; native rendering is device-verified.** State machines, resolution
  helpers, theme/capability logic → Jest tests written first (`src/**/__tests__/`). Map
  rendering, gestures, and camera behaviour are verified on-device, not unit-tested.
- **Persist the minimum.** Only state that must survive a restart is persisted (Zustand
  `partialize`); session/UI state stays in-memory.
- **Hold the type and quality line.** No new `any`/`as any`/`@ts-ignore`/`eslint-disable`
  without a one-line justification of why it is necessary. `npm run verify` (types, tests,
  seams/secrets/cycles/duplication, lint) must be green before a change is done — it runs in the pre-push
  hook and in CI.
- **A check enforces a *response*, not an *outcome*.** Lint rules are heuristics, not oracles:
  going red does not always mean the code is wrong (`react-hooks/exhaustive-deps` and friends
  have legitimate deliberate exceptions). So a red heuristic rule may be resolved **either** by
  fixing the code **or** by an inline `eslint-disable` with a one-line justification — a justified
  disable is a first-class outcome, not a failure. **Never reshape correct, clear code solely to
  satisfy a rule** — that is the linter contorting your architecture. But if you cannot write an
  *honest* justification, it is a real finding: fix it at the source. (Facts — type errors, test
  failures, the seam/secret/cycle/duplication tests — are not heuristics and have no discretionary
  escape; the duplication test's only escape is a `DUPLICATION_EXEMPT` entry with a rationale.)
- **Icon-only controls carry an `accessibilityLabel`.** Prefer routing icon buttons through
  `ControlButton`, which requires the label at compile time; text buttons are auto-labeled by
  React Native and need none.
- **Reviewing is evidence-driven.** Trace a finding to its consumers before calling it a
  defect. Read the platform's actual type or runtime payload before calling an adapter
  redundant. Prove a fix with a test that fails before it and passes after. Fixing a hot path
  or extracting a helper is not a licence to stop reading the surrounding code, and never
  codify accidental drift into a shared API.
- **Features go through brainstorm → spec → plan** (`docs/superpowers/`), not
  straight-to-code. Small changes still get a design thought through before implementation.
  Every spec carries an **`## Existing shape`** section: the closest existing feature of the
  same shape (or "none"), what will be reused from it, and what is extracted to be shared.
  "Nothing to share" is an acceptable answer only with the reason.

When a request tempts you toward a shortcut that violates the above, surface the tension
instead of silently taking the shortcut.

# The debug log

The app keeps its own log in SQLite, readable and shareable from Settings → Debug log. It is the
**first place to look** for a bug reported from the field. Write to it with
`logEvent(level, area, message, detail?)` from `src/log` — fire-and-forget, never awaited. It
**never records coordinates**: a position is logged as an accuracy and a distance, never a latitude
or longitude. See `docs/architecture/debug-log.md`.

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
