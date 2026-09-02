---
description: Dependency & version-pin freshness check
---

# Deps-Check — dependency & version freshness

Report on dependency drift and reconcile the version pins the docs depend on. **Report and
recommend — never upgrade or edit anything without the user asking.**

Run and read:

```
npm outdated        # direct deps behind their latest / wanted
npx expo-doctor      # Expo SDK health, native/config mismatches
```

Then reconcile the Expo docs pin:

- Read the `expo` version in `package.json` and the Expo SDK version referenced in `AGENTS.md`
  (the "Read the exact versioned docs" line). If the **major** disagrees with `package.json`'s
  `expo` major, flag it — the docs link is stale and any agent following it is reading the
  wrong SDK.

## Report

A short list, grouped:

- **Expo SDK** — installed version, whether `expo-doctor` is clean, and whether the AGENTS.md
  docs pin matches. Call out a major-version mismatch as must-fix.
- **Behind & worth updating** — direct deps with a meaningful gap; note any that are pinned
  deliberately (bleeding-edge TypeScript, React 19, Expo canaries) and why a bump might break
  the lint/type toolchain (e.g. `typescript-eslint` / `madge` peer ranges lagging a new TS
  major).
- **Security** — anything from `npm audit` that affects runtime (not just dev/build).

End with a clear recommendation: which to bump now, which to hold, and why. Stop there.
