# Weak-signal warning while recording

On Foot does not tell the walker when the GPS signal is too weak to record.

## Why this is out of scope

Since the fix gate (`docs/design/specs/2026-10-27-fix-gate-design.md`), a fix whose accuracy is worse
than 50 m is never stored. Two field situations then record nothing for as long as they last: a
canyon or dense cover where every fix is coarse, and approximate-only location permission (Android
12+), where every fix reads in the kilometres. The line and the distance stall; when good fixes
return, the track resumes with one straight chord.

The owner decided on 2026-11-01 that this stays silent. A stalled line is already the honest picture
of "no usable position", and before the gate both situations produced a track that was unusable
anyway (a zig-zag of coarse fixes, or kilometre granularity). A hint would be one more transient
state on a screen meant to be glanced at, for a case the walker can see on the map.

The debug log keeps the evidence: every `fix batch` entry carries `droppedAccuracy` and
`worstRejectedAccuracy`, so a field report of "it stopped recording" can be told apart from a
capture fault.

## Prior requests

- `PROP-43`: "a recording under a weak signal stalls with no word to the walker" (fix gate challenge
  review, 2026-10-27).
