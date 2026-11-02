---
severity: should-fix
category: enhancement
size: M
triage: ready-for-agent
source: "owner, tasks.md (moved 2026-10-26)"
blocked_by: ["[[PROP-48-no-globe-frame-at-launch]]"]
---
# IDEA-18: start from the last camera position

Owner idea. The app starts from the whole-earth view. The map store persists only `mapStyleId` and a
selected trail, no camera — and
`docs/design/specs/2026-08-21-onfoot-rn-restore-last-map-state-design.md` keeps camera position
session-only on purpose ("every launch re-follows the user"), so this revisits a locked decision.
`docs/adr/0003-last-camera-restored-when-free.md` records the reversal and why.

Absorbs `FIELD-37` (merged 2026-11-02). Owner observation: after saving or discarding an
activity, the camera came back on the whole-world view — or on a framing that exactly fit Corsica —
and re-zoomed to the user instead of keeping the framing it had. Not reproduced on 26/10 (identical
framing frame by frame after save and after discard; evidence
`.scratch/device-checks/2026-10-26/C/23-after-save-*`, `30-after-discard-*`). The save screen is
pushed over the same map instance and popped with `router.back()`; neither `finishRecording` nor
`discardRecording` touches the camera, the follow mode or a pending fit. The only automatic re-zoom to
the user in the code is the cold-start one (follow mode `position` by default, not persisted), so the
symptom reads as a process relaunch while the save screen was open (`FIELD-1`), which is exactly the
launch this idea wants to land on the last camera instead of the globe. The "fits Corsica" framing has
no explanation in the code: no bounds fit is triggered on return.

## Comments

> *Comment written by an AI agent.*

Arbitrage utilisateur 02/11 → `FIELD-37` fusionnée ici (`wontfix`, fichier supprimé). Le périmètre de
cette idée inclut désormais le cas « retour sur la carte après Save activity / Discard » : quand le
process a été relancé entre-temps, la carte doit repartir de la dernière caméra et non du globe. Si le
symptôme réapparaît sans relancement (pas de splash, retour immédiat), c'est un bug distinct à rouvrir
en `FIELD-n`.

> *Comment written by an AI agent.*

Grilling 02/11 → `ready-for-agent`. Décisions : (1) l'état de suivi est persisté tel quel (position
seule ou position + cap) ; suivi actif au départ → le lancement re-suit comme aujourd'hui ; caméra
libre → la dernière caméra est restaurée. (2) Pas de seuil de distance : la vue restaurée tient même
loin de l'utilisateur. (3) La dernière caméra = centre + zoom + pitch + heading. (4) Capturée à chaque
arrêt de mouvement caméra, pas seulement au passage en arrière-plan. (5) Dernière caméra invalide →
ignorée, suivi comme avant, une ligne de debug log. (6) Aucune image du globe au lancement en caméra
libre : attendre l'hydratation du store et poser la caméra initiale de façon déclarative. Glossaire :
Follow / Free camera / Last camera. ADR 0003.

## Agent Brief

Split 02/11 into four tickets, in order: `PROP-45` (spec), `PROP-46` (map port framing + initial
camera), `PROP-47` (free camera restored at launch), `PROP-48` (no globe frame). They carry the
briefs; this ticket closes when `PROP-48` does.
