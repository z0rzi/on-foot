---
status: open
blocked_by: []
closes: []
---
# 02: the check plan earns each claim, and the agent runs only the plan

**What to build:** a caller writing a check plan names, for each claim, why only the device can
show it and its cheapest evidence, and sees the plan's claim-set waits added up before it
dispatches; the device-check agent runs those claims and puts any further variant in its report as
a suggestion, unrun. After a defect, a re-check brief lists only the claims to run again.

- [ ] `BRIEF.md`, per claim: why only the device can show it (rendering, OS or lifecycle behaviour, a native module, persistence across a kill); a claim the Jest suite answers is dropped, or read once in a state the check reaches anyway, never built up on the phone in real time
- [ ] `BRIEF.md`, per claim: its cheapest evidence: `fast` pace or a jump unless the claim reads pace, the shortest dead or background stretch that shows the behaviour, one theme, layer and font scale unless the claim is about them
- [ ] `BRIEF.md`, for the plan: its claim-set waits with their total, and the owed entries of `docs/tickets/device-checks.md` the same build reaches
- [ ] `BRIEF.md`: a re-check brief lists only the failed claims and those the fix can touch, on one build
- [ ] The `device-check` skill's list and run steps: the brief's claims are the scope; a variant beyond them goes under **Other observations** as a suggestion, unrun
- [ ] Written with `writing-for-agents`; the brief points at the skill and restates none of its rules
- [ ] `npm run verify` green
