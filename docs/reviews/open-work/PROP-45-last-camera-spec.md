---
severity: should-fix
category: enhancement
size: S
triage: ready-for-agent
source: "agent, 2026-11-02 (split from IDEA-18)"
blocked_by: []
---
# PROP-45: write the last-camera spec

First of the four tickets that deliver `IDEA-18` (`PROP-45` → `PROP-46` → `PROP-47` → `PROP-48`).
AGENTS.md puts a spec before any code; the decisions are already settled in `IDEA-18`'s grilling
comment and in `docs/adr/0003-last-camera-restored-when-free.md`, so this is writing them down, not
reopening them. The three tickets after it are the plan.

## Agent Brief

**Category:** enhancement
**Summary:** Write the spec for restoring the last camera at launch when the camera was free.

**Current behavior:**
No spec. The restore-last-map-state spec (2026-08-21) still says every launch re-follows; ADR 0003
reverses it.

**Desired behavior:**
A spec under `docs/design/specs/` that states the behaviour of `IDEA-18`'s grilling decisions, uses
the glossary's Follow / Free camera / Last camera, and links ADR 0003. `## Existing shape`: the
2026-08-21 spec and the map store's persisted subset (what is reused, what joins it).
`## Failure modes`: invalid or missing last camera, slow or failed store hydration, no location
permission or no position yet, a restored trail selection alongside a restored free camera. The
2026-08-21 spec gets a one-line pointer to ADR 0003 where it locks the session-only camera.

**Acceptance criteria:**
- [ ] Spec written with both mandatory sections; every decision in `IDEA-18`'s grilling comment
      appears in it, none added.
- [ ] Its slicing matches `PROP-46`..`PROP-48`, or those tickets are updated to match it.

**Out of scope:**
- Any code.
- Revisiting the grilling decisions; a disagreement found while writing goes back to the owner.
