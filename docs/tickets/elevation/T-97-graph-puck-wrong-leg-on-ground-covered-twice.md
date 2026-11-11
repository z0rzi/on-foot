---
severity: should-fix
category: bug
size: L
triage:
origin: owner
filed: 2026-11-10
from: "[[2026-11-06-hiking-ux-design]]"
blocked_by: []
---
# T-97: the graph puck takes the wrong leg on ground the trail covers twice, and never corrects

Where a trail passes over the same ground twice (an out-and-back, a lollipop's stem), the puck can
land on the wrong pass and stay there for the rest of the hike. The open card's ahead lines
(`src/elevation/trailAhead.ts`) read the puck's `s`, so the distance left and the next climb are
wrong with it. This is the limit the T-23 design recorded as "deliberate shortcut skipping ahead,
rare, self-corrects"; on doubled ground it does not self-correct.

Feature-sized: it goes brainstorm → spec → plan, and the spec absorbs
[[T-96-detect-reversed-hike]], which the owner ruled to be the same rule (below).

## Reproduced

With the helpers of `src/elevation/__tests__/trailProgress.test.ts` (`trailThrough`, `walk`,
`replayAlongTrail`, `puckDistance`), run on 2026-11-10 in a throwaway test:

| Trail | Walk | Right | Got |
|---|---|---|---|
| `[0,0],[1000,0],[0,0]` | `[0,0],[600,0],[600,200],[300,200],[300,0],[200,0]`: leave at 600, cut across, rejoin heading home | 1800 | 200 |
| `[0,0],[500,0],[1000,0],[1000,500],[500,500],[500,0],[0,0]` | `[0,0],[800,0],[800,-100],[450,-100],[450,0],[200,0]`: give up the loop, rejoin the stem | 2800 | 200 |
| `[0,0],[2000,0]` | `[0,0],[500,0],[500,200],[1500,200],[1500,0],[1600,0]`: a shortcut on ground covered once | 1600 | 1600 |

So a shortcut alone is handled; the defect needs a rejoin on doubled ground.

## Cause

`stepAlongTrail` (`src/elevation/trailProgress.ts:164`) picks among the passes within the radius
by `|p.s - previous|` alone (`:174`), and `previous` comes through an off-trail stretch unchanged
(`:172`). The walker's direction of motion is read only inside one pass (`pointOfPass`, `:156`),
never between passes. On doubled ground, position cannot tell the two passes apart; only the
direction walked over the next fixes can, and by then the choice is made and continuity keeps it.

## Reported by prototypes, not reproduced in the repo

Five agents prototyped against copies of the module on 2026-11-10; the prototypes were not kept.
Their numbers are on synthetic GPS noise. Each of these is to be reproduced as a red test before
it is believed:

- **A plain out-and-back with no shortcut**: one backward jitter fix while leaving the turnaround
  takes the outward piece, the next fix is outside the fold, and continuity locks it. Wrong leg at
  the end of the walk in 3 of 20 runs at 5 m noise, 6 of 20 at 10 m.
- **A recording started on the return leg** (`walk([600,0],[200,0])` on the out-and-back): 200,
  where 1800 is right. The first fix takes the nearest pass, ties to the lowest `s`.
- **Legs drawn a few metres apart**, first fix 1 m nearer the return leg: the whole outward walk is
  mirrored until the turnaround.
- **A turnaround walked 40 m off the drawn line**, or a silent gap in the fixes across it: the
  outward leg is kept on the way home.
- **Switchbacks 15 m apart, cut from leg 1 to leg 3**: leg 2 is assigned until the next hairpin.
- **A pause 20 m before a turnaround** with 4 m jitter: `s` flips between the two sides of the fold.

## What the owner ruled (2026-11-10)

- **Turning home early on doubled ground flips the puck to the return leg**, once the walker has
  gone a flip distance against the trail. This reverses the test `out-and-back turned early`
  (`trailProgress.test.ts:121`), which asserts the puck goes back down the outward leg. The same
  motion is the lollipop's loop skipped at the junction.
- **A short walk back does not flip.** Going back 200 m for a dropped glove keeps the leg; walking
  500 m toward the car flips. 500 m is the working figure, not a tested value.
- **A long walk back that was not a retreat is allowed to be wrong for a while.** On a 5 km
  out-and-back, back from 4 km to 2 km and out again: the puck goes down the outward leg for the
  flip distance, jumps to the return leg, and jumps back a flip distance after the walker turns
  outward again. Two jumps, then right with nothing asked of the walker. The mirror point is the
  same ground, so the puck's height is right and the next climb is the one in front of the walker;
  only the distance left is off.
- **Against the trail on ground covered once, for the flip distance, flips the trail**: T-96, one
  rule with the above. Where another pass runs the walker's way the puck takes it and the trail is
  not flipped; the trail flips only when none does.

## Direction

Of the fifteen proposals, three families survived their authors:

- **Decide once at the rejoin**, by direction. Fixes the reproduced cases; a wrong choice is still
  permanent, and it does nothing for a turn with no off-trail stretch. Every agent's fallback.
- **Direction first at every fix**, continuity as the tiebreak. The smallest change and the most
  cases fixed; with direction read from one step it flipped legs during a pause and lost the
  switchback scenario under noise, so it needs a smoothed heading. It flips at once, which the
  short-walk-back ruling refuses.
- **Scored hypotheses**: one `{s, cost}` per candidate pass, walking against a pass costs, a jump
  between passes costs once, the puck is the cheapest. Nothing is latched, so a wrong pick is
  overtaken. The two agents who measured under noise picked it. The flip distance is its jump
  cost, and "the trail reversed" is one more hypothesis with the same cost. Three or four coupled
  weights, tuned so far on synthetic noise only.

The owner's rulings point at scored hypotheses. It stays a pure fold, so `advanceReplay` and the
`replay equals step-by-step` contract hold, and `useGraphPuck` does not change for the puck alone.

## For the spec

- The weights are checked by replaying real recorded activities against their trails, not only
  synthetic walks.
- No closed-loop scenario is in the test file. Four passed on the current module on 2026-11-10, on
  `[0,0],[400,0],[400,400],[0,400],[0,0]`, and become tests the new matcher must keep where the
  rulings above do not change them: back and forth mid-trail (300, 200, 300, 250) and across the
  start (100, 0, 1550, 1500, 1600, 50, 100); back 200 m at three quarters then on to the end
  (1200, 1000, 1200, 1600); the whole loop in reverse (0, 1550, down to 0); a lap begun at 600
  (up to 1600, 50, on to 600).
- Laps over the same ground in the same direction have nothing to tell them apart; continuity
  with `s` stays the only rule there.
- Whether a recording that starts at the trail's end takes a shorter flip distance, at the price of
  a second threshold: a hike walked wholly in reverse otherwise reads the wrong way for its first
  flip distance.
