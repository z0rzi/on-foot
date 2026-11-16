---
severity: minor
category: bug
size: S
triage:
origin: agent
filed: 2026-11-15
from: "[[2026-11-15-device-check-speed-rerun]]"
blocked_by: []
---
# T-107: selecting again a trail or activity just shown derives its route twice

Seen on the device on 2026-11-14 (release build of `c7f942b`). An activity was saved, shown,
cleared with **Stop showing activity**, then selected again from the Activities list. The debug
log then holds, oldest first, all at 23:48:02–03:

```
map fit requested   {"by":"select","kind":"activity"}
map route derived   {"kind":"activity","points":66,"ms":0.2}
map map mode        {"mode":"activity"}
map route loaded    {"kind":"activity","points":66,"ms":39}
map route derived   {"kind":"activity","points":66,"ms":0.3}
map fit fired       {"kind":"activity"}
```

The first `route derived` comes before `route loaded`, so it derives a copy held from the
earlier showing. The same thing happened with a trail selected again after **Stop showing trail**
at 23:27:33, where the toolkit's labels line of that day folded the two identical lines into one.

From the source: `useLoadedEntity` (`src/components/useLoadedEntity.ts`) keeps its last
`{ id, result }` in state when the id goes to null. `resolveLoad`
(`src/components/loadedEntity.ts:16-19`) answers `ready` with that entity as soon as the same id
comes back. The effect still reloads it, and the new object's `geometry.segments` is a new array,
so `useRouteDisplay`'s memo keyed on `segments` (`src/map/useRouteDisplay.ts`) runs the
profile/banding pass again and logs it again. The first selection of an entity, with nothing held,
has not been looked at.

Two costs: on a long trail the pass runs twice, and that pass is the cost T-4 measures; and T-4's
reading gets two `route derived` lines for one selection, where its "Why a human" expects one
beside one `route loaded`.

## Seen again, 2026-11-16

In the check-hooks re-run of the field-diagnostics check (release build of `f864514`,
[[2026-11-16-check-hooks-rerun]]), the same sequence: an activity saved and so shown, cleared with
**Stop showing activity**, selected again from the Activities list, then `fit requested`, `route
derived {"kind":"activity","points":7,"ms":0.1}`, `map mode`, `route loaded
{"kind":"activity","points":7,"ms":34.4}`, `route derived` again, `fit fired`, all at
11:19:31–32. The first selection of the trail, nothing held, wrote one `route derived` after its
`route loaded`.
