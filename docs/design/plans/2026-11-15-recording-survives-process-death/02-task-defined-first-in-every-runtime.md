---
status: open
blocked_by: []
closes: []
---
# 02: The task is defined first in every runtime

**What to build:** while the app is dead, the fixes Android delivers reach the handler and are
stored, and the debug log shows which runtimes started without the app. Spec §1 and §4.

- [ ] A root `index.ts` is the package's `main` and imports `src/bootstrap`, then
      `expo-router/entry`, and nothing else.
- [ ] Bootstrap installs the global error handler (moved out of `app/_layout.tsx`), writes
      `launch` / `runtime started`, then imports `locationTask`. Nothing under `app/` imports
      `locationTask` any more.
- [ ] `cold start` carries the runtime's age in ms.
- [ ] The structural test of the spec's Testing section, in `src/architecture/__tests__/`, fails
      on a fixture that breaks each rule.
- [ ] The two invariants of §1 are stated where the code upholds them.
- [ ] `debug-log.md`: `runtime started` and the age on `cold start`.
- [ ] Device check on a release build of this item: `am crash` mid-recording, dead 60 s. While
      dead, `runtime started` with no `cold start`, then a `fix batch` with `kept` above zero
      about every 8 s (broken: no `fix batch` until the app is reopened). Without 01, a host per
      delivery is expected here; don't measure threads.
- [ ] `npm run verify` green.
