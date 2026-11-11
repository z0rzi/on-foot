---
severity:
category: idea
size:
triage:
origin: owner
filed: 2026-11-10
from:
blocked_by: ["[[T-97-graph-puck-wrong-leg-on-ground-covered-twice]]"]
---
# T-96: detect a hike walked in reverse and reverse the trail

Owner idea. A walker who starts at the trail's end and follows it backwards gets the trail flipped:
direction arrows, elevation graph and what lies ahead read the way they are walking.

To explore: the detection. `src/elevation/trailProgress.ts` already tracks the profile distance
`s` per fix, so walking backwards shows as `s` falling steadily. The hard case is a trail whose
start and end share the same stretch (a loop, a lollipop, an out-and-back): there the first fix
matches both ends, `s` picks the nearest pass, and direction alone may not say which way the
trail is being walked until the shared stretch is left behind.

## Folded into T-97 (owner, 2026-11-10)

The detection is the rule of [[T-97-graph-puck-wrong-leg-on-ground-covered-twice]], and the two are
specified together: once the walker has gone a flip distance against the trail (500 m as the
working figure), the matcher takes them to be going the other way. On ground covered twice that
is the other pass, and the trail is not flipped. On ground covered once there is no other pass, so
it is the trail reversed. An out-and-back walked home early therefore never flips the trail.

- **In the matcher**, "the trail reversed" is one more hypothesis: the same place read as
  `length − s`, on which the walker goes forward, paying the flip distance once.
- **A long walk back flips twice.** On a loop, going back more than the flip distance for something
  dropped mirrors the graph, and it mirrors again a flip distance after the walker turns round.
  Under the flip distance nothing moves. The owner accepted the same for the puck on doubled
  ground.
- **A lollipop's loop walked the wrong way round** is covered: the loop is ground covered once, so
  the trail flips there and the stem home reads correctly.
- **The whole loop in reverse already places the puck**: on the current module it runs from the
  right edge down to 0 (measured 2026-11-10). What reads the wrong way is what is counted toward
  the trail's own end: `trailAhead` (`src/elevation/trailAhead.ts:54`) and the direction arrows.

## Open

- **What "reverse the trail" changes.** Proposed: the matcher gives `s` and a reversed flag, and
  the graph, the arrows and the ahead lines read the flag for this recording; the stored trail is
  not touched. Not yet ruled by the owner.
- **The first flip distance of a hike walked wholly in reverse** reads the wrong way. A shorter
  distance for a recording that starts at the trail's end would fix it with a second threshold;
  on a loop the start and the end are the same place, so it would not help there.
