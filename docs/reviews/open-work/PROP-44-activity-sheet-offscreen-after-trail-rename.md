---
severity: investigate
category: bug
size:
triage: needs-triage
source: "device check, 2026-11-02"
blocked_by: []
---
# PROP-44: the activity sheet was left off-screen after renaming its linked trail

Seen once during the PROP-40 device check (release build of `overnight/2026-11-01`), not
reproduced in two retries. Steps: select an activity linked to a trail, drag its sheet to the
expanded snap (`sheet settled {"mode":"activity","index":1}`), go to the Trails tab, rename the
linked trail through Edit trail, come back to the Map tab. The activity stayed selected ("Viewing
activity" pill) but the sheet sat below the screen: `uiautomator` reported its bounds at
`[0,2400][1080,2234]`, i.e. parked at the window height, and nothing wrote a `sheet settled`
entry after 11:38:54. The floating graph was empty and the camera framed the 0 m track at maximum
zoom. The same steps afterwards, from the collapsed and from the expanded snap, kept the sheet in
place and updated the "View linked trail" label.

This is the FIELD-2 symptom (a sheet left at its pre-layout position) in a new path. A plausible
trigger, unconfirmed: since the PROP-40 review fix, `useSelectedActivity` is keyed to activities
version + trails version, so any trail mutation re-reads the selected activity and hands
`MapScreen` a new `Activity` reference (and a new route) while the Map tab is detached. Whether a
new reference can reset gorhom's position, or whether this is FIELD-2's older cause, needs the
debug log of a reproduction. Evidence: `.scratch/device-checks/2026-11-02/sheet-*.png`.
