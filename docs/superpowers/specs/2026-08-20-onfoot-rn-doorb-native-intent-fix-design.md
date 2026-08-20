# Door B (GPX open-with) fix: native-intent redirect — Design

**Status:** approved (brainstorm)
**Date:** 2026-08-20
**Scope:** fix the OS "open with" path (Door B) of the trails add-GPX slice.
**Supersedes:** the `useGpxOpenHandler` approach from
`2026-08-20-onfoot-rn-trails-add-gpx-design.md` §"Door B".

## Problem

Opening a `.gpx` from another app fires an Android `ACTION_VIEW` intent whose
data is a `content://` URI (e.g. `content://media/external/downloads/1000058466`).
On device this lands on expo-router's **"Unmatched Route"** screen instead of the
add-GPX form. Two root causes (both flagged as risks in prior reviews, now
confirmed on device):

1. **Suffix guard misses content URIs.** `app/_layout.tsx`'s `useGpxOpenHandler`
   only routes URLs matching `/\.gpx($|\?)/i`. Content URIs have no file
   extension, so the guard rejects them and never routes to the form.
2. **Collision with expo-router deep-linking.** The manual `Linking` listener
   runs *alongside* expo-router's own linking, which maps the incoming file URI
   to a nonexistent route (normalized to `onfootrn://media/...`) → Unmatched
   Route. Even a fixed guard would race the framework.

The intent filter itself is correct and (after a clean prebuild) registered:
the app matches a `content://` GPX `VIEW` intent. Only the JS-side reception is
broken.

## Approach

Replace the manual handler with expo-router's official interception hook,
`redirectSystemPath` in **`app/+native-intent.ts`**. expo-router calls it on the
raw incoming URL *before* route-matching, for both cold start (`initial: true`,
from `getInitialURL`) and warm start (`initial: false`, the `url` event) —
verified in the installed expo-router 57.0.14
(`build/getLinkingConfig.js`, `build/link/linking.js`). Whatever it returns
becomes the href expo-router routes to, so returning a valid in-app path
eliminates the Unmatched-Route collision. Keying off the URI **scheme** (not a
`.gpx` suffix) fixes the content-URI miss.

Rejected alternatives: patching the manual `Linking` listener (still races the
framework's own linking — fragile); a custom native intent module (overkill).

## Design

### New: `app/+native-intent.ts`
```ts
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.startsWith('content://') || path.startsWith('file://')) {
    return `/trail/new?uri=${encodeURIComponent(path)}`
  }
  return path
}
```
- A single pure function. File-open intents (`content://`/`file://`) are
  redirected into the add-GPX form with the original URI preserved (encoded) as
  the `uri` param. Every other link (the app's own `onfootrn://` scheme, https
  app links) passes through unchanged.
- The Android intent filter already scopes which files can launch the app to
  GPX, so any file-open URI reaching this hook is a GPX import — no per-URL
  content-type sniffing needed here.

### Changed: `app/_layout.tsx`
- Remove `useGpxOpenHandler` and its now-unused imports (`expo-linking`,
  `router`, `useEffect`). Net deletion. The migration gating
  (`useDatabaseMigrations` → pending/error/success) is unchanged.

### Unchanged (verify only): the reader + form
- `readGpxFile(uri)` uses `new File(uri).text()`, which per the expo-file-system
  57 types supports `content://` (SAF) URIs — no change expected; verify on
  device.
- `app/trail/new.tsx` already reads `params.uri`, parses, and falls back for the
  name to `parsed.title ?? params.name ?? ''`. Content URIs carry no filename, so
  Door B passes only `uri`; the form uses the GPX `<name>` — which is more
  reliable than a filename anyway. No change.

## Data flow (Door B, after fix)
1. User picks "Open with → On Foot" on a `.gpx` in another app.
2. Android matches the intent filter, launches the app with the `content://` URI.
3. expo-router calls `redirectSystemPath({ path: 'content://…', initial })`.
4. It returns `/trail/new?uri=content%3A%2F%2F…`.
5. expo-router routes to the form; the form reads the URI, parses, shows metrics.
6. User classifies + saves → returns to the list.

## Testing
- **Pure unit test (TDD):** `redirectSystemPath` —
  `content://…` → `/trail/new?uri=content%3A%2F%2F…`;
  `file:///…/x.gpx` → `/trail/new?uri=file%3A%2F%2F…`;
  `onfootrn://trail/new` → unchanged; `https://example.com/x` → unchanged.
  Assert the `uri` param round-trips via `decodeURIComponent`.
- **Device-verified (release build only — see below):** cold start open-with →
  form populates with the GPX's metrics/name → save → trail listed. Verified on
  device 2026-08-20 with a `--variant release` build: `redirectSystemPath`
  received the raw `content://media/external/downloads/<id>` URI and routed to
  `/trail/new`; `readGpxFile` read the content URI directly (no copy-to-cache).

- **IMPORTANT — Door B only works in a release/production build.** The Expo
  **dev-client launcher** intercepts the launch intent and loads the app via its
  own `onfootrn://expo-development-client/?url=…` deep link, which bypasses
  expo-router's `getLinkingConfig` `nativeLinking` — so `redirectSystemPath` is
  **never called in a dev-client build**, and an open-with lands on "Unmatched
  Route" there. This is expected dev-client behavior, not a code defect. Verify
  Door B with `npx expo run:android --variant release` (Door A and everything
  else verify fine in the dev/debug build). The redirect logic itself is covered
  by the pure unit test regardless of build type.

## Architecture-rule compliance
- Smallest clean fix at the right layer (the framework's own interception hook),
  not a patch bolted onto the racing manual listener; it removes more code than
  it adds.
- Pure logic (`redirectSystemPath`) is TDD'd; native open-with is
  device-verified.
- Seam untouched; no engine imports added.
