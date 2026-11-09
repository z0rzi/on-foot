---
severity: 
category: idea
size:
triage:
origin: owner
filed: 2026-11-09
from: "field notes, hike of 2026-11-08"
blocked_by: []
---
# T-85: hike stats in the recording notification

Owner idea. The recording notification shows the hike's figures instead of the fixed "Recording
your activity". Today the text is a constant in `RECORDING_OPTIONS.notification`
(`src/recording/options.ts`), handed once to the location port when background tracking starts;
whether the port can update it mid-recording is unchecked.
