# Worklist batch 2026-11-01

**Goal:** close seven agent-reachable worklist tickets in one branch (`overnight/2026-11-01`),
each in its own commit, with the device checks they owe listed for the owner.

**Picked:** `PROP-41`, `PROP-40`, `PROP-6`, `FIELD-35` + `PROP-42` (one change), `PROP-39`,
`PROP-2`, `PROP-3`. **Left:** `FIELD-1` and `FIELD-5` need the phone; `FIELD-37` was not
reproduced and needs the owner; `PROP-9` needs a design call on where a log lives before the
database exists (a new storage seam), which is the owner's to make.

Batches like this one have a single plan instead of one spec per ticket: every ticket is size S and
already carries its evidence. Each section below is the design: the decision, the `Existing shape`
and the `Failure modes` AGENTS.md asks of a spec. `PROP-2` asks for its own spec, so it gets one.

## Global constraints

- **TDD for pure logic** (`src/**/__tests__/`), tests written first and seen failing.
- **Seams** (`src/architecture/seams.ts`): Mapbox stays in `src/map/providers/mapbox/`, SQL in
  `src/data/db/`.
- **Gate:** `npm run verify` green from the main checkout before each commit.
- **Closing a ticket:** delete its file in `docs/reviews/open-work/` in the commit that closes it.
  A runtime or visual claim no device has confirmed goes in the "Pending device checks" section of
  `docs/reviews/open-work.md`. Device verification is the owner's; never claim it.
- **Commits:** the repo's style (`type(scope): summary (ID)`), staging only the files the ticket
  touched. `docs/reviews/open-work.base` carries an uncommitted change of the owner's: never stage it.
- No change-narrating comments.

## PROP-41 — GPX import decodes numeric character references

**Decision.** The parser decodes what XML defines: the five named entities (already) plus decimal
and hexadecimal numeric references (`&#039;`, `&#x27;`). HTML-named entities (`&eacute;`) are not
XML and stay literal; a file using them without a DTD is not well-formed GPX. Configure
`fast-xml-parser` 5.11 to do this (its `htmlEntities` option drives `numericAllowed`; read
`node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js` and the entity decoder to find
the option value that enables numeric references without the HTML named set, and keep `&amp;`
working). If the library cannot separate the two, decode numeric references on the extracted
strings in `parse.ts` as a small pure helper.

**Existing rows** keep their raw text. Rewriting user data in a migration for three names the owner
can fix by renaming is not worth a data migration; the ticket's closing note says so.

**Existing shape.** `src/data/trails/gpx/parse.ts` and its tests; nothing new to share.

**Failure modes.** A malformed reference (`&#xZZ;`, `&#;`) must not throw: it stays literal or the
file fails as `format` exactly as other malformed XML does today. Test it. An out-of-range code
point (`&#1114112;`) likewise must not throw.

## PROP-40 — a trail delete publishes the activity change it makes

**Decision.** `trailsRepository.deleteTrail` changes two entities (the trail row, and
`activities.linked_trail_id`), so the store-level mutation publishes both: after a trail delete the
activities store reloads and bumps its version too. One owner for this: the trail store's
`removeTrail`, through a published operation on the activities store (no reaching into its state).
Check the import graph: `cycles.test.ts` must stay green.

**Race to close.** The sheet that logs the miss (`ActivityInfoSheet` → `useLoadedEntity`) reloads
on the **trails** version; the selected activity (`useSelectedActivity` → `useSelectedEntity`)
re-reads asynchronously on the **activities** version. Bumping both in the same tick can still let
the sheet look up trail 43 with the stale activity. Order the publication so the selected activity
is fresh before the trails version moves, or key the linked-trail load on the activity's
`linkedTrailId` so a stale id is never looked up after the delete. Pick the one that fixes the
order at its root, and prove it with a test that reproduces the warning before the fix (store or
hook level, the `logEvent` mock asserting no `linked trail not found`).

**Existing shape.** The two stores' `commit` (`src/store/trailsStore.ts`,
`src/store/activitiesStore.ts`) are siblings; keep them aligned.

**Failure modes.** The activities reload failing after the delete succeeded: the delete still
stands and `removeTrail` rejects the way it does today on a failed trails reload; no new silent path.

## PROP-6 — debug log area filter

**Decision.** Per the ticket's brief: one chip per `LogArea`, multi-select, all on by default,
session state (component state, not persisted), export unaffected. The filter is a pure function
over entries and the set of enabled areas, tested first. The list of areas comes from one source of
truth next to the `LogArea` type (a `LOG_AREAS` tuple the type derives from), not a second literal
list in the UI.

**Existing shape.** `src/components/EnumSelector.tsx` is a single-select chip row. The multi-select
row is its second instance: extract the shared chip (look, label, accessibility) so both rows use
it, rather than copying the styles. The chip carries `accessibilityState={{ selected }}`.

**Failure modes.** All areas off: the list shows its empty state, the export still exports every
entry. A log with no entry in an enabled area: the same empty state.

## FIELD-35 + PROP-42 — navigation chrome and status bar follow the theme

**Decision.** One owner for the scheme's effect on native chrome, at the root layout:

- A navigation `ThemeProvider` (`expo-router` re-exports React Navigation's) built from the app's
  own colours (`src/theme/colors.ts`) for the current scheme, so every native header (New trail,
  Edit trail, Debug log, Offline maps, Save activity) gets surface background, on-surface title and
  tint. The theme mapping is a pure function, tested. `ScreenHeader` keeps no per-screen style.
- `StatusBar` follows the scheme (`style="auto"`, or the explicit style derived from the same
  scheme), replacing the fixed `light`.

The map tab draws light Mapbox styles in both schemes, so in dark scheme its status bar stays
light-on-light-map. Making the status bar follow the map style is a separate call for the owner,
recorded in the pending device checks, not built here.

**Existing shape.** `useTheme` / `getColors` is the theme source; reused, not duplicated.

**Failure modes.** Scheme changes while the app is open: both follow on the next render (the
provider and status bar read `useColorScheme`). `useColorScheme` returning `null`: same fallback as
`getColors`.

## PROP-39 — no stale sheet edge after the sheet closes

**Decision.** `sheetTop` is written by `MapInfoSheet`, which unmounts in free mode and leaves its
last edge behind. The writer owns the reset: when the sheet unmounts it returns `sheetTop` to the
"no sheet" value `graphBottom` already treats as no edge (0). Then the `app active` entry in free
mode reads `sheetTop: 0`, and the comment in `useSheetGeometryLog.ts` is rewritten to state what 0
and `windowHeight` mean. Also check the ticket's second question (does the next sheet start from
the stale value for a frame): with the reset it starts from 0, which `graphBottom` already reads as
"no edge yet"; state this in the commit.

**Existing shape.** The FIELD-2 handover comment in `MapScreen.tsx`; nothing new to share.

**Failure modes.** None new: 0 is an existing sentinel. If the pure part (the reset rule) is
extractable, test it; the rendering itself is device-verified (pending device check).

## PROP-2 — the map port's follow mode speaks the app's vocabulary

Per the ticket's brief and the owner's ruling. Its own short spec under `docs/design/specs/` first
(`## Existing shape`, `## Failure modes`), then the change: an app-owned follow type on the port,
the `'normal'`/`'compass'` translation inside `src/map/providers/mapbox/` only as a tested pure
mapping, `'course'` gone, no duplicated literal, no import cycle. Follow behaviour unchanged. The
ARCH-3 paragraph in `docs/reviews/open-work.md` mentions `course` and `PROP-2`: update it.

## PROP-3 — the custom puck fills Mapbox's image slots

Per the ticket's brief: confirm or refute from `node_modules/@rnmapbox/maps` (JS and the Android
native source) that a custom `bearingImage` leaves `top` and `shadow` unregistered. Confirmed →
supply them so the puck looks the same (a transparent image if the default look must not change),
inside the mapbox provider only; refuted → record the finding in the ticket and leave it open.
logcat check is the owner's (pending device check).

## Order

Independent tickets, run one at a time in the main checkout so each `npm run verify` sees one
change: PROP-41, PROP-40, PROP-6, FIELD-35+PROP-42, PROP-39, PROP-2, PROP-3. Then `/code-review`
over the branch since `master`, then a fix round.
