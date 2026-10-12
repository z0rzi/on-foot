# Offline is a requirement on every map provider, not a capability

The map port (`src/map/provider/`) describes what a provider can do so the rest of the app stays
provider-agnostic, and a MapLibre swap is planned. `MapCapabilities` carried an `offline: boolean`
alongside `supportsTerrain`, implying the app might run on a provider that cannot download tile
packs and would hide the offline UI. It will not: the owner will only ever pick providers that
support offline downloads — a hiking app that cannot show its map without a network is not
acceptable. So offline is an invariant, not a capability, and we enforce it in the type rather than
gate on it at runtime: `MapProvider.offline: OfflineController` is a required member, a provider
without it does not compile, and the boolean was deleted (2026-10-11).

**Considered and rejected:** wiring the flag as a real gate — an `'unsupported'` offline status,
no badge, no download menu, no settings row when false. It was fully specified and reversed the
same day. A gate whose condition is always true *by policy* has a false branch that no provider will
ever reach; keeping it would have been dead code with tests, and a standing invitation to someone to
pick a provider the product cannot live with. `supportsTerrain` stays a capability because terrain is
a nicety the app genuinely renders without.
