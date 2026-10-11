# Coding standards

Read at review time, by `/_last-checks` through `/code-review`. The base standard is the
**Architecture principles** section of `AGENTS.md` (seams, no quick-fixes, existing patterns,
small units, TDD for pure logic, persist the minimum); it is not repeated here. The decisions a
change is allowed to make live in its spec under `docs/design/specs/`, written before the code,
so a reviewer judges against that spec and never against an after-the-fact list.

Everything `npm run verify` enforces is omitted on purpose: types, tests, the seam registry,
verbatim duplication, import cycles, import and export rules, secrets, floating promises, lint.
A rule below is a judgement call no gate can make. Each one says what it is, why it matters and
how a breach is fixed, so a finding can cite it and propose the fix in one line.

## Imports at the data seam go to the leaf, not the barrel

**What.** A data module's barrel constructs its singleton (`src/data/trails/index.ts` wires
`trailsRepository` to `openDatabaseSync`), so importing the barrel opens the database on import.
Only the composition point (the store) imports a data barrel; pure consumers and UI import types
from the leaf (`src/data/trails/types`).
**Why.** Routing a type import through the barrel drags the engine and a DB open into pure UI and
into its unit tests. The split is principled, not accidental, and "unifying" it is a regression.
**Fix.** Point the import at the leaf module that holds the type. Do not move the singleton.

## A wrapped native module's types are not ground truth for its runtime payload

**What.** Adapter code behind a seam that wraps a native module is checked against the installed
platform source (`node_modules/<lib>/android|ios`), per platform, not against the `.d.ts`.
**Why.** A field typed as a number that Android emits as a string, or a payload key named
differently per platform, passes `tsc` and `jest` (the module is mocked) and surfaces only on a
device.
**Fix.** Read the native source for the payload the adapter consumes, normalise at the seam, and
name the platform difference in the adapter.

## Derived or cached state has one owner

**What.** State that must track an authoritative source (a registry, the database, the network)
is kept fresh by exactly one owner: a schema constraint, a single tagged field, a derived
selector. Not by a freshness convention repeated at each call site.
**Why.** Convention-based sync drifts the first time a new call site forgets the convention.
**Fix.** Move the guard into a structural invariant or a single selector, and delete the
hand-written copies.

## Risky render paths degrade instead of relying on the root error boundary

**What.** A render path that parses, indexes or assumes non-null async data either cannot throw
or renders a visible fallback of its own. The root `ErrorBoundary`
(`src/components/ErrorBoundary.tsx`) is the last resort, not the plan.
**Why.** A throw in render unmounts the whole screen into the generic fallback; the user loses
context and the log records nothing specific.
**Fix.** Guard the input before render, or render the feature's own degraded state with a way
back.

## Every new file names its sibling

**What.** For each file a change creates, the existing file with the same role (a second
`XListItem`, `XForm`, `XBadge`, `XSheet`, `useSelectedX`) is named, and the change says whether
the shared shape was reused or extracted. The spec's `## Existing shape` section is where this is
declared.
**Why.** The `duplication` gate sees only verbatim copies. A copy that renames every identifier
is caught here or not at all, and the second instance of a shape is where duplication is born.
**Fix.** Extract the shared shape (`EntityListItem`, `EnumBadge`, `useSelectedEntity` are the
precedents) or state, with the reason, why nothing is shareable.

## Every new export has a consumer outside its own file and its test

**What.** Each new export, piece of state, prop, parameter or helper is read by something other
than its own definition and its test. Stubbed controls with no wiring, leftover diagnostics and
anything built "for later" count as unused.
**Why.** Dead code is read, maintained and reviewed for nothing, and a dead control is a promise
the UI breaks.
**Fix.** Delete it. If it is needed by work that has not landed, it belongs in that work's diff.

## Presentation logic stays out of the data layer

**What.** Formatters, view helpers and UI copy live in presentation modules (`src/format/`, a
feature's `format.ts`), never under `src/data/`, and the data layer never imports UI.
**Why.** The data layer is the part that survives a UI rewrite and a provider swap; a string for
the screen inside it couples the two.
**Fix.** Move the helper beside its consumer. The `format*` export ban under `src/data/` is
mechanical; this rule covers the helper that is not named `format*`.

## Sibling functions make the same choices

**What.** Functions that play the same role in two features make the same cache-update,
error-handling, import-style and naming choices. A fork is one sibling memoizing while the other
does not, or one deriving during render while the other sets state in an effect.
**Why.** A fork between siblings is a pattern being born twice; the next agent copies whichever
it opens first.
**Fix.** Align the newer sibling on the older one, or change both deliberately and say so in the
spec.

## A voided promise is a decision about who learns of its failure

**What.** Each `void promise` states, by its surrounding code, that the failure cannot matter to
the user, or routes the rejection to a visible outcome and the debug log.
**Why.** `no-floating-promises` only proves the promise was not forgotten. Whether a silently
failed save, download or permission request must reach the user is a judgement.
**Fix.** Add the `.catch` that logs and surfaces, or leave the `void` with the reason evident.

## Escapes carry a one-line justification

**What.** No new `any`, `as any`, `@ts-ignore` or `eslint-disable` without a one-line
justification of why it is necessary, on the line.
**Why.** Lint flags the escape; only a reader can tell whether it is earned or hides a real type
or a real defect. An unjustified escape cannot be told apart from a lazy one.
**Fix.** Write the honest justification, or fix the type or the code at the source if none can
be written.

## Icon-only controls carry an accessibility label

**What.** An interactive element with no visible text has an `accessibilityLabel`. Icon buttons
go through `ControlButton`, which requires the label at compile time; text-bearing buttons are
auto-labeled by React Native and need none.
**Why.** The a11y lint plugin does not support this ESLint major, so the only enforcement is
structural, and a bare `Pressable` around an icon bypasses it.
**Fix.** Route the control through `ControlButton`, or add the label where that is impossible.

## Comments describe the current state, never the change

**What.** A comment says what the code is or why it is so. It does not narrate what was changed,
what it used to do, or which fix it applies.
**Why.** The code is read many more times than it is changed; a change-narrating comment is wrong
the moment the next change lands and is never updated.
**Fix.** Delete the narration. Keep the non-obvious why, rewritten in the present tense.
