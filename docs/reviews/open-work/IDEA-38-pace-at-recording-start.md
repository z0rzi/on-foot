---
severity:
category: bug
size:
triage: needs-triage
source: "owner, tasks.md (moved 2026-10-26)"
blocked_by: []
---
# IDEA-38: pace at recording start reads absurdly high

Owner observation, "not really a bug". Just after starting a recording, walking around a little
gives a pace like 1000 hours per km — correct arithmetic, not nice to see.

## Comments

> *Comment written by an AI agent.*

Reproduced 26/10, phone still. 0 m / 0.0 km/h up to 0:09, then 675 m / 170.8 km/h at 0:14,
1.3 km / 199.1 km/h at 0:24, then 0:27 min/km in pace view at 0:36. The distance ÷ time average is
right; the distance is what is wrong: fixes with ~380 m accuracy are kept and jump 675 m
(`IDEA-17`). The absurd figure at the start is therefore first that bug. Hiding the pace while the
distance is too short would still be useful afterwards. Evidence:
`.scratch/device-checks/2026-10-26/C/25-*`, `26-*`.
