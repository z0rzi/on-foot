# Navigate to a Trail's Starting Point — Design

**Status:** Approved design
**Branch:** `worktree-navigate-to-trail-start`
**Date:** 2026-10-02

## Goal

Getting to a trail is the part of a hike the app does not help with. The trail's geometry is
already on the device, but the walk from "I picked this trail" to "I am at the trailhead" happens
in another app that the user has to open and re-enter the coordinates into by hand.

Add one item to the trail sheet's ⋮ menu — **Navigate to start** — that hands the trail's first
recorded point to whichever map app the user wants, letting Android's own disambiguation dialog
make that choice. Google Maps, Waze, Organic Maps and OsmAnd all register for the intent we send,
so the app does not need to know any of their names.

## Existing shape

The closest existing shape is the **offline ⋮ menu** on the same sheet
(`src/trails/TrailInfoSheet.tsx:116-120`): a measured anchor, a `Modal`-hosted list, and items
derived from state by a pure builder (`offlineMenuItems` in `src/map/offline/menu.ts`). That shape
is reused wholesale — this change adds an item to that menu rather than introducing a second
control.

**What is extracted to be shared:** `OfflineActionsMenu` moves to `src/components/ActionsMenu.tsx`.
Its props are already domain-free (`{ label, danger?, onPress }[]`); only its name, its folder and
its header comment tie it to the offline feature. A second *kind* of action is exactly the moment
that shape would otherwise be copied, so it is generalised now, while there is still one copy.

**What is reused unchanged:** `offlineMenuItems` stays offline-specific; the anchor measurement,
the `Modal` hosting and the upward-opening positioning are untouched; `showToast`
(`src/components/toast.ts`) is the existing non-blocking failure surface; `logEvent` is the existing
field-diagnosis surface.

**Nothing to share, with reason:** there is no existing outward app-launch to follow — the app has
never opened another app, and `expo-linking` appears in `package.json` only as an `expo-router`
transitive need. The inbound direction has a home (`src/trails/useIncomingShare.ts`,
`app/+native-intent.ts`); the outbound direction gets one here.

## Scope

- `src/external/geoUri.ts` — new: the URI, pure.
- `src/external/openMapApp.ts` — new: the launch, the log, the failure toast.
- `src/external/index.ts` — new: the barrel, following `src/log/index.ts`.
- `src/map/geo.ts` — add `startPointOf`.
- `src/components/ActionsMenu.tsx` — moved from `src/map/offline/OfflineActionsMenu.tsx`.
- `src/components/actionItem.ts` — new: the `ActionItem` contract, following `enumField.ts`.
- `src/trails/trailActions.ts` — new: the pure item builder, following `offlineMenuItems`.
- `src/trails/TrailInfoSheet.tsx` — call the builder, relabel the ⋮.
- `src/architecture/seams.ts` — the `external-apps` entry.
- `docs/architecture/seams.md` — add the `external-apps` row to *Seams enforced today*.
- Tests: `src/external/__tests__/geoUri.test.ts`,
  `src/external/__tests__/openMapApp.test.ts`, and new cases in `src/map/__tests__/geo.test.ts`.

**Out of scope:** any equivalent action for activities (`ActivityInfoSheet` has no ⋮ menu, and
routing to a *recorded past* activity has no clear meaning); navigating to a point other than the
start (nearest point, trail end, "resume where I stopped"); routing *inside* On Foot; moving the ⋮
`Pressable` onto `ControlButton`, which is pre-existing and unrelated.

## The change

### 1. The URI — `src/external/geoUri.ts`

```ts
export function geoUri(point: { lat: number; lng: number }, label: string): string
```

Produces `geo:<lat>,<lng>?q=<lat>,<lng>(<label>)` with coordinates at six decimals.

Three decisions, each load-bearing:

- **Six decimals** (~0.1 m) rather than the raw float. A GPX latitude round-trips through
  `Number` as 15 significant digits; a URI carrying `45.123456789012345` is noise, not precision.
- **The coordinates appear twice.** Apps that read only the `geo:` path still get the point; apps
  that read `q=` get the point *and* the trail's name on the pin. Omitting either loses one group.
- **The label's parentheses are percent-encoded** on top of `encodeURIComponent`, which leaves
  `(` and `)` untouched. The `q=` label syntax is parenthesis-delimited, so a trail named
  `Col de Bise (boucle)` would otherwise close the label early and corrupt the pin's name.

### 2. The launch — `src/external/openMapApp.ts`

```ts
export async function openMapApp(point: { lat: number; lng: number }, label: string): Promise<void>
```

Builds the URI and `await openURL(...)` from `expo-linking` — the single import of that module in
the whole app. On success, `logEvent('info', 'map', 'handed destination to the OS chooser')`. On
rejection, `logEvent('warn', 'map', 'map app launch failed', { error: String(error) })` and
`showToast('No map app found')` — lowercase message and `String(error)` detail being the log's
existing conventions (`src/recording/recordingController.ts:43`).

The success message says what the code can observe and no more. `openURL` resolves as soon as
`startActivity` returns — when the chooser is *drawn*, before the user picks anything — so a line
claiming the app was opened would assert an outcome the app cannot see, in the log that is meant to
be the first place to look for a field report.

`openURL` is typed `Promise<true>` in SDK 57 and documented to reject "if there are no applications
registered for the URL or the user cancels the dialog". The cancel half is the iOS confirmation
sheet: on Android, `startActivity` has already resolved by the time the disambiguation dialog is
drawn, so backing out of the chooser cannot reject a settled promise — and the app is Android-only
today, as `showToast` itself records. The toast therefore names the dominant cause, not the only
one: React Native's `IntentModule.openURL` rejects with `Could not open URL …` for *any*
exception, so "No map app found" is an informed simplification, with the true error in the log.

**No `canOpenURL` pre-check.** On Android 11+ it returns `false` for any scheme absent from a
`<queries>` manifest block, and Expo's config has no first-class key for `<queries>` — a pre-check
would require a custom `withAndroidManifest` plugin in order to make the feature *less* reliable
than letting the launch fail and reporting it.

**No `expo-intent-launcher`.** `openURL` already dispatches `ACTION_VIEW`, which is the intent a
`geo:` URI needs. The SDK docs steer toward `expo-intent-launcher` only as the replacement for
`Linking.sendIntent`, which this design does not use.

**No coordinates in the log.** Both log lines record the fact of the hand-off and nothing more, per
the debug log's standing rule that a position is only ever an accuracy and a distance.

### 3. The seam — `src/architecture/seams.ts`

```ts
{
  name: 'external-apps',
  tokens: ['expo-linking'],
  allow: ['src/external/'],
  rationale:
    'Only src/external hands a URL to another app; features ask it to open a destination and never reach for the linking SDK.',
}
```

This is why `expo-linking` is used rather than React Native's `Linking`, which has the same
`openURL`. The seam test keys on the module specifier, and `Linking`'s specifier is `react-native`
— a token every component in the app already imports, so the boundary would be unenforceable by
construction. Picking the Expo module is what makes the door enforceable, and keeps a future
second outward launch (a weather page, an OSM link) from scattering.

### 4. The start point — `src/map/geo.ts`

```ts
export function startPointOf(segments: GpxPoint[][]): GpxPoint | null
```

The first point of the first non-empty segment, or `null`. It sits beside `overallEndpoints`, which
already resolves both ends for the map's markers, and shares its "skip empty segments" rule.

It returns a `GpxPoint` — named `lat`/`lng` fields — and not the `[lng, lat]` tuple the rest of
`geo.ts` yields. That file's tuples exist because the map SDK consumes GeoJSON order; a `geo:` URI
wants the opposite order, and handing a positional pair across that reversal is a coordinate swap
waiting to happen. The one caller outside the map's rendering path gets the unambiguous shape.

### 5. The menu — `src/components/ActionsMenu.tsx` and `TrailInfoSheet`

`OfflineActionsMenu` moves to `src/components/ActionsMenu.tsx` under the name `ActionsMenu`, with
its header comment rewritten to describe a menu anchored to a ⋮ rather than an offline menu
specifically. The implementation does not change.

`TrailInfoSheet` then composes:

```ts
const navigate = startPointOf(trail.geometry.segments)
const items = [
  ...(navigate ? [{ label: 'Navigate to start', onPress: () => void openMapApp(navigate, trail.name) }] : []),
  ...offlineMenuItems(state).map((item) => ({ ...item, onPress: handlers[item.action] })),
]
```

**Navigate to start comes first**, above the offline items: it is the action taken before each
hike, where the offline items are preparation done once. The menu stays a flat list with no divider,
as it is today. The ⋮'s `accessibilityLabel` changes from `"Offline actions"` to `"Trail actions"`,
which is now what it opens.

The item is **absent**, not disabled, when `startPointOf` returns `null`. The no-route guard makes
that unreachable for anything imported since 2026-09-10, but trails persisted before it can still
hold empty segments, and an action that cannot work should not be offered.

## Rejected alternatives

- **`google.navigation:q=…&mode=w`**, which starts walking turn-by-turn immediately and saves one
  tap. Only apps declaring that scheme appear in the chooser — Google Maps and Waze — so every
  offline map app a hiker actually relies on (Organic Maps, OsmAnd) vanishes from the list. Wrong
  trade for this app.
- **An in-app app picker**: detect installed apps with `canOpenURL` and deep-link each with its own
  best routing URL. Needs the `<queries>` manifest work described above, plus a table of per-app URL
  formats to maintain, to reimplement the dialog Android already draws — and it would override a
  default the user has deliberately set.
- **`https://www.google.com/maps/dir/?api=1&…`**: cross-platform and starts directions, but being an
  `https` URL it puts every installed browser in the chooser beside the map apps.
- **Adding `'navigate'` to `OfflineMenuAction`** and calling `openURL` from the sheet. The smallest
  diff, and it makes `offlineMenuItems` return items that are not about offline maps. The menu's
  generalisation is the honest version of the same change.

## Consequences accepted

- **The user lands on a labelled pin, not on turn-by-turn.** Starting the route is one more tap, in
  the map app's own UI. This is the direct cost of letting every map app compete for the intent, and
  it was chosen knowingly.
- **A user with no map app installed sees a toast and nothing else.** Near-nonexistent on Android,
  and the debug log records the underlying error for the one report that ever arrives.
- **`geo:` has no travel mode.** The map app picks its own default — driving, usually. Walking
  cannot be requested without going app-specific, which is the rejected alternative above.
- **The trail's name on the pin depends on the receiving app.** Some read the `q=` label, some show
  only the coordinates. Nothing in the intent can force it.
- **`src/external/` starts life with one caller.** It is a seam, not a layer: its value is that the
  second outward launch has an obvious home and the test enforces it.
- **The seam's token scan does not stop `Linking.openURL` from `react-native`.** `expo-linking`'s
  `openURL` is a thin passthrough — `node_modules/expo-linking/build/RNLinking.js` re-exports React
  Native's own `Linking` verbatim, so they are the same object. A file can still
  `import { Linking } from 'react-native'` and call `openURL` with every gate green; the seam raises
  the cost of bypassing it rather than making it impossible. Closing that gap needs a different
  mechanism — an eslint `no-restricted-imports` rule keyed on the named binding, or extending
  `src/architecture/importRules.ts`, which today keys on module path rather than named binding —
  and is deliberately left as a follow-up.

## Test plan (Jest, written first)

`src/external/__tests__/geoUri.test.ts`

1. A plain point yields `geo:<lat>,<lng>?q=<lat>,<lng>(<label>)` with both coordinate pairs.
2. A 15-digit latitude is emitted at six decimals.
3. A negative longitude keeps its sign.
4. A label with spaces and accents is percent-encoded.
5. A label containing `(` and `)` has both encoded, so exactly one parenthesis pair remains in the
   URI — the regression the raw `encodeURIComponent` would let through.

`src/external/__tests__/openMapApp.test.ts` (with `expo-linking` mocked)

6. On a resolved `openURL`, the URI passed matches `geoUri` for the same input, one `info` event is
   logged, and `showToast` is not called.
7. On a rejected `openURL`, `showToast` is called exactly once with `'No map app found'`, a `warn`
   event carries the error message, and the returned promise still resolves — the sheet's
   `void openMapApp(...)` must never raise an unhandled rejection.
8. Neither logged event's message or detail contains the latitude or longitude.

`src/map/__tests__/geo.test.ts` (new cases)

9. `startPointOf([])` is `null`.
10. `startPointOf([[], []])` is `null`.
11. A leading empty segment is skipped and the first point of the first non-empty one is returned.
12. The returned object is the trail's first point, with `lat` and `lng` unswapped.

`src/trails/__tests__/trailActions.test.ts`

13. With a start point, the first item is `{ label: 'Navigate to start' }` and it precedes the
    offline items.
14. With `start` as `null`, the result is the offline items only, in their original order, and
    contains no item labelled 'Navigate to start'.
15. Invoking the navigate item's `onPress` calls `navigateTo` exactly once with the start point
    that was passed in.
16. The offline items pass through unchanged — same order, and a `danger: true` flag is preserved.

Not unit-tested, by policy: the menu's rendering, and the chooser itself.

## Device verification

1. Open a trail's sheet, tap ⋮ — **Navigate to start** is the first item, above the offline items.
2. Tap it: Android's disambiguation dialog lists the installed map apps.
3. Pick Google Maps — the pin sits at the trailhead and carries the trail's name.
4. Pick a second app (Organic Maps or Waze) — the same point resolves there.
5. Back out of the chooser without choosing: no toast appears, and the sheet is unchanged.
6. Settings → Debug log shows one `map` entry per hand-off, with no coordinates in it.
7. A trail in the `downloading`, `available` and `failed` offline states still shows its own items
   below the new one, and the ⋮ reads "Trail actions" to a screen reader.

## Verification note

`npm run verify` run from inside a worktree matches `/.claude/worktrees/` in jest's
`testPathIgnorePatterns` and collects **zero** tests, reporting green regardless. Run the suite with
an explicit override (`npx jest --testPathIgnorePatterns=/node_modules/`) while working here.

`--testPathIgnorePatterns` is an *array* option, so it swallows a trailing path as a second ignore
pattern — silently excluding the very file you meant to run. To target one file, put the path
**first**: `npx jest <path> --testPathIgnorePatterns=/node_modules/`.
