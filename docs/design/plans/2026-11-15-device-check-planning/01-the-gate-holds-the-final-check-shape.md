---
status: open
blocked_by: []
closes: []
---
# 01: the plan-items gate holds the final-check shape

**What to build:** a planning agent who puts a device criterion anywhere but a plan's final check,
or leaves the final check anywhere but last, sees `npm run verify` name the item and the rule. The
plan conventions and `AGENTS.md` say the same: a plan's device criteria live only in its final
check, a worker on another item does no device work, the final check runs once after the plan's
last code review, and a defect it finds is re-checked on its own claims and those the fix can
touch.

- [ ] A device criterion is a checkbox line starting `Device:`; a line mentioning the `device-check` skill without the prefix is not one
- [ ] The new key `final_check` (`true` | `false`, absent reads as `false`) joins the gate's keys and enums
- [ ] For a plan with any device criterion: exactly one `final_check` item; no device criterion outside it; every other open item reaches it through `blocked_by`; no item is blocked by it
- [ ] A `final_check` item with no device criterion is flagged; a plan with neither, and `plan.md` alone, pass
- [ ] Each rule tested first on fixtures in the plan-items test (the spec's Testing Decisions list), on the core shared with the ticket gate
- [ ] The issue tracker's "Plan work items", `/to-tickets` and `/implement-spec` sections, and the item template, carry the key and the rules
- [ ] `AGENTS.md`'s device-verification line says a plan's device verification is its final check, once, at its end
- [ ] `npm run verify` green
