---
status: open
blocked_by: ["[[07-tap-to-select]]"]
closes: ["[[T-26-all-activities-on-map]]"]
---
# 08: a tap on a cluster fits it or lists it

**What to build:** a tap on a cluster below the cap fits the map to the starts it holds, never
zooming past the cap, ending follow through the store's one-shot camera pattern (D118, D134). At
the cap or past it, or when several pins lie under the finger, a modal lists the items (name,
distance, completed count); a row selects that item; closing it selects nothing. The modal uses
the sheet shell extracted in 05, its rows reuse `EntityListItem`, and it scrolls when long. The
adapter reads a cluster's keys from the pins source (D126). This lands the whole of T-26.

- [ ] Cluster press: below the cap fits the starts with the cap as the zoom limit, at the cap opens
      the list, several pins open the list (tests)
- [ ] Device: Verification 7 (a cluster fits up to the cap; two items on the same start open the
      list), a cluster tap while following ends follow then fits
- [ ] Owner: Verification 10 (tap comfort, dimming level, cluster reach), noted as owed
- [ ] `npm run verify` green
