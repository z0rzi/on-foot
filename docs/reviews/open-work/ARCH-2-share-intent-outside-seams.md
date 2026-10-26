---
severity: minor
category: enhancement
size: S
triage: ready-for-agent
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# ARCH-2: a native boundary outside the seam scanner

`modules/share-intent` calls `requireNativeModule` directly and nothing stops a second call or a
direct `expo-modules-core` import in `src/`. Fix: add `modules` to the scan roots and a seam entry,
or record the exemption in `seams.md`.

## Agent Brief

**Category:** enhancement
**Summary:** The `share-intent` native module becomes a registered seam the scanner enforces.

**Current behavior:**
The local `share-intent` Expo module calls `requireNativeModule('ShareIntent')` from
`expo-modules-core`. The seam scanner only scans `src/`, and no `Seam` entry covers
`expo-modules-core`, so a second direct call or import elsewhere would pass every gate.

**Desired behavior:**
The scanner also scans the local `modules/` tree. A `Seam` entry in `SEAMS` names the
`expo-modules-core` token, allows it only inside the share-intent module, and carries a rationale.
`docs/architecture/seams.md` lists the new seam.

**Key interfaces:**
- `Seam` (`name`, `tokens`, `allow`, `rationale`) and the `SEAMS` array.
- The seams test's file collection (scan roots).

**Acceptance criteria:**
- [ ] The seams test scans `modules/` as well as `src/`.
- [ ] A new seams test case flags an `expo-modules-core` import outside the allowed directory.
- [ ] The existing share-intent module passes.
- [ ] `seams.md` documents the seam.
- [ ] `npm run verify` is green.

**Out of scope:**
- Refactoring the share-intent module itself.
- Build outputs under `modules/**/build/`, which stay excluded.
