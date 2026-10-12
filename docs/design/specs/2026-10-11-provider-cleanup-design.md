# The traps a provider change would trip over

Closes backlog **row 10**: **DEAD-1**, **DEAD-2**, **DEAD-3**, **ARCH-3**, **ARCH-4**, **DOC-5**.
Companion decision: `docs/adr/0002-offline-is-a-provider-requirement.md`.

## The decision behind it

`MapCapabilities.offline` was set to `true` by the only provider and read by nothing. ARCH-4 and
DEAD-1 left two mutually exclusive fixes to the owner: wire the gate the flag promises, or delete
the flag. A spec to wire it was drafted on 2026-10-11 and **reversed the same day** when the owner
stated the constraint that settles it:

> I will only ever pick providers which do offline. Not having offline support in the app is not
> acceptable.

So offline is not a *capability* — something a provider may lack and the app degrades without. It is
an **invariant**: every provider must have it. A gate on an invariant is dead by construction, not
merely untested. And the invariant is already enforced structurally: `MapProvider.offline:
OfflineController` is a **required** member of the port (`src/map/provider/types.ts:165`), so a
provider without offline does not type-check. The boolean was a weaker restatement of that fact,
and the two could disagree.

**The flag is deleted. The type is the gate.** The rest of row 10 was bundled with it in the review
for one reason — each item is a trap the next provider or token change would trip over — and the
only thing keeping the bundle apart was this decision.

## The problem, as observed

Verified against the tree on 2026-10-11.

**DEAD-1 / ARCH-4 / DOC-5** — `MapCapabilities` (`types.ts:15-22`) declares `requiresToken`,
`supportsDataDrivenLayers` and `offline`. All three are set in `mapbox/capabilities.ts:7-10` and
read nowhere; every production `caps` read in the tree is `caps.styles` or `caps.supportsTerrain`.
`isValidCapabilities` (`types.ts:168-180`) has no production consumer — its only callers are its own
test (`provider/__tests__/types.test.ts`) and one assertion in `mapbox/__tests__/capabilities.test.ts:12`.
The `OfflineController` comment (`types.ts:146-148`) says the `offline` flag "gates whether it is
meaningful for a given provider" — describing a gate that was never built and now never will be.

**DEAD-2** — `primary` (`theme/colors.ts:4,35,66`) and `overlayScrim` (`:16,47,78`) are declared on
the theme type and populated in both palettes; no consumer reads either.

**DEAD-3** — `SizeEstimate.tileCount` (`offline/types.ts:5`) is produced at `estimate.ts:35` and read
only by `estimate.test.ts:33,39`. Its one production consumer, `OfflineLayerChooser.tsx:68,77`,
reads `estimate?.bytes` and nothing else.

**ARCH-3** — `mapbox/adapter.tsx:52` casts `followUserMode as unknown as Mapbox.UserTrackingMode`.
The port declares `followUserMode?: 'normal' | 'compass' | 'course'` (`types.ts:27`);
`Mapbox.UserTrackingMode` is a string enum whose values are exactly those three strings
(`Follow = 'normal'`, `FollowWithHeading = 'compass'`, `FollowWithCourse = 'course'`). The cast
works because the values coincide, and says nothing about *which* port literal means *which*
provider mode — the correspondence the seam exists to declare.

## Existing shape

**For the capability cleanup**: `supportsTerrain` is the model of a real capability — set by the
provider, read at two render sites (`MapCanvas.tsx:133`, `MapControls.tsx:123`), and the app renders
without terrain when it is false. The three deleted flags *looked* like it and were not: nothing
reads them, and for `offline` nothing should. What remains in `MapCapabilities` is exactly the set
that fits the definition — `id`, `styles`, `supportsTerrain`. Nothing is extracted; the type gets
smaller.

**For ARCH-3**: the same adapter already has the shape in the other direction. `mapbox/offline.ts`'s
`mapPackState` translates a provider value (native pack state, string or number by platform) into a
port value, declared once at the seam. The follow-mode map is its mirror — port literal → provider
enum — and sits beside it in the adapter. Nothing to share between them beyond the shape; two
three-line translations do not warrant a helper.

## The change

**1. `MapCapabilities` shrinks to what is read.** `types.ts`:

```ts
export interface MapCapabilities {
  id: string
  supportsTerrain: boolean
  styles: StyleDescriptor[]
}
```

`requiresToken`, `supportsDataDrivenLayers`, `offline` go from the type and from
`mapboxCapabilities`. `isValidCapabilities` and `provider/__tests__/types.test.ts` are deleted;
`mapbox/__tests__/capabilities.test.ts` keeps its `supportsTerrain` assertion and drops the validator
line. Nothing else in `src/` or `app/` references any of them.

**2. The port comment states the invariant** (DOC-5). The `OfflineController` comment stops describing
a gate and says what is true: offline is a requirement on every provider, enforced by the required
`offline` member on `MapProvider`; there is no capability flag because there is no provider without
it. One sentence points at the ADR for the why.

**3. Two theme tokens go** (DEAD-2). `primary` and `overlayScrim` are removed from the theme type and
both palettes in `theme/colors.ts`.

**4. `estimatePackSize` returns bytes** (DEAD-3). Dropping `tileCount` leaves `SizeEstimate` as a
one-field wrapper whose only consumer reads `.bytes`, so the wrapper goes too:
`estimatePackSize(...): number`. `OfflineLayerChooser.tsx:68` holds `estimateBytes: number | null`
instead of `estimate: SizeEstimate | null`, and `:77`'s `r.estimate?.bytes` becomes `r.estimateBytes`.
`tileCountForBounds` is unchanged and stays exported — it is the tested building block.

**5. An explicit follow-mode map** (ARCH-3). In `mapbox/adapter.tsx`, beside `Camera`:

```ts
const TRACKING_MODE: Record<NonNullable<CameraProps['followUserMode']>, Mapbox.UserTrackingMode> = {
  normal: Mapbox.UserTrackingMode.Follow,
  compass: Mapbox.UserTrackingMode.FollowWithHeading,
  course: Mapbox.UserTrackingMode.FollowWithCourse,
}
```

and `followUserMode={followUserMode && TRACKING_MODE[followUserMode]}`. `Record` over the port
union is exhaustive by type: a fourth port literal without an entry is a compile error, not a
runtime fall-through. The double cast and its lack of justification both disappear.

## Testing

This is a deletion change with one translation added, and the tests follow:

- `provider/__tests__/types.test.ts` is deleted with the validator it tested.
- `mapbox/__tests__/capabilities.test.ts` keeps "mapbox capabilities are terrain-capable" without the
  `isValidCapabilities` assertion.
- `estimate.test.ts`'s two `estimatePackSize` cases are rewritten against the number: expected value
  is `tileCountForBounds(tiny, 10, 16) * VECTOR_BYTES_PER_TILE` (resp. raster), and the
  raster-exceeds-vector comparison is unchanged in meaning.
- No new unit test for `TRACKING_MODE`: `Record<Union, Enum>` is already checked exhaustively by the
  compiler, and a test asserting three constant lookups would test TypeScript, not the app.
- `npm run verify` green is the gate; the `seams` test is unaffected since no seam entry changes.

**Device verification — the owner's step, one check.** ARCH-3 is the only edit on a runtime path.
The enum values equal the port literals, so behaviour should be identical, but the camera is native
rendering and is verified on-device, not claimed: follow mode in `normal`, `compass` and `course`
behaves as before, and leaving follow mode still passes `undefined` through.

## Failure modes

None that reach a user, with the reason for each:

- **Offline, network drop, permission denied** — not applicable; no I/O, no permission, no network
  path is touched.
- **Empty or malformed input** — not applicable; the only new logic is a constant lookup whose key
  type is a closed union. `undefined` follow mode is passed through as `undefined`, as today.
- **Cancel mid-operation** — not applicable; nothing asynchronous is added.
- **Render-time throw** — none introduced. `TRACKING_MODE[followUserMode]` cannot miss: the index type
  is the `Record`'s key type.
- **A provider without offline** — cannot exist: `MapProvider.offline` is required, so the build
  fails. That is the failure mode this change *installs* as the enforcement, deliberately.

## Out of scope

- **`OfflineBadgeState` is misnamed** — it drives the badge, the progress block and the ⋮ menu. Not a
  review finding; listed on the worklist as its own item on 2026-10-11, not folded in here.
- **Leftover Mapbox tiles after the MapLibre swap.** `packs` is `controller.listPacks()`, the
  provider's own native listing, so a new provider never sees the old one's packs. The bytes are
  invisible to the app either way and are a one-time native cleanup for the MapLibre change, not a
  consequence of anything here.
- **DEAD-4**, **TEST-1**, **ARCH-2** — separate small items, unrelated to this row.
