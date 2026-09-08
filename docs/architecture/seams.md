# Architecture seams

A **seam** is an inviolable boundary: a native SDK or engine that only one directory may
import, so the rest of the app stays provider-agnostic and swappable. Seams are declared as
data in one place and enforced automatically.

## The registry is the source of truth

All seams live in `src/architecture/seams.ts` as the `SEAMS` array. Each entry:

```ts
{
  name: 'map-provider',
  tokens: ['@rnmapbox/maps'],      // import specifiers that are forbidden outside the boundary
  allow: ['src/map/providers/'],   // the only path prefix(es) allowed to import those tokens
  rationale: '…',                  // one line, printed in the failure message so it teaches
}
```

The `seams` Jest test (`src/architecture/__tests__/seams.test.ts`) scans all production
source (`src` + `app`, excluding `__tests__`) and fails if any file outside `allow` imports a
forbidden token. It runs with every `npm test` / `npm run verify`, locally, in the pre-push
hook, and in CI. Docs do **not** enumerate seams — they point here.

## How to add a seam

When a change introduces a new boundary — a wrapper around a native SDK, or a new provider
port — register it **in the same change**:

1. Add one entry to `SEAMS` with the forbidden `tokens`, the `allow` prefix, and a `rationale`.
2. Run `npm test`. If existing code already violates the new seam, either move the offending
   import behind the boundary or widen `allow` deliberately.

That is the whole process. One array entry; the test, the gate, and the docs follow.

## Seams enforced today

| name | tokens | allow |
|------|--------|-------|
| `map-provider` | `@rnmapbox/maps` | `src/map/providers/` |
| `persistence` | `expo-sqlite`, `drizzle-orm` | `src/data/db/` |
| `net` | `@react-native-community/netinfo` | `src/net/` |

## The persistence seam's row types are checked, not cast

`src/data/*/mapping.ts` declares hand-written `Row` interfaces so the domain never imports drizzle
types. The repositories in `src/data/db/` pass drizzle's inferred rows straight to those mapping
functions with **no cast** — TypeScript checks the two shapes are compatible at that call. Renaming,
retyping or changing the nullability of a column the domain reads is therefore a compile error at the
repository line, not a runtime surprise. Never reintroduce `rows[0] as XRow`: it does not fix a type
mismatch, it hides one.

## Candidates under review (not yet seams)

These native modules are used in more than one place and would each become a seam once
consolidated behind a single wrapper directory. Registering them now would fail the test;
consolidating them is a separate, device-verified refactor.

- **`expo-location`** — `src/map/useLocationPermission.ts`, `src/recording/locationTask.ts`,
  `src/recording/options.ts`, `src/recording/recordingController.ts`. Natural boundary: a
  location wrapper (perhaps under `src/recording/`).
- **`@react-native-async-storage/async-storage`** — `src/store/mapStore.ts`,
  `src/settings/preferencesStore.ts`. Natural boundary: a small persisted-preferences wrapper.

## Related checks

The same `src/architecture/` scanner backs two sibling invariants: `secrets.test.ts` (no
token literals in source; `.env` gitignored) and `cycles.test.ts` (no circular imports). Add
new whole-codebase structural checks here, in the same style.
