import { haversineMeters } from '../data/geo/metrics'
import type { TrackPoint } from '../data/activities/types'
import { LocationFix } from '../location'

const MAX_ACCURACY_M = 50
const MAX_SPEED_MPS = 10
const JUMP_FLOOR_M = 50
const RECOVERY_ACCURACY_M = 20

export type Anchor = Pick<TrackPoint, 'lat' | 'lng' | 't'>
interface RejectedJump { metres: number; allowedMetres: number; seconds: number }
export interface GateResult {
  kept: LocationFix[]
  candidate: LocationFix | null
  droppedAccuracy: number
  droppedJump: number
  recovered: number
  worstRejectedAccuracy: number | null
  worstJump: RejectedJump | null
}

export function gateFixes(fixes: LocationFix[], anchor: Anchor | null, candidate: LocationFix | null): GateResult {
  const result: GateResult = {
    kept: [],
    candidate,
    droppedAccuracy: 0,
    droppedJump: 0,
    recovered: 0,
    worstRejectedAccuracy: null,
    worstJump: null,
  }
  for (const fix of fixes) {
    if (fix.accuracy !== null && fix.accuracy > MAX_ACCURACY_M) {
      result.droppedAccuracy++
      result.worstRejectedAccuracy = Math.max(result.worstRejectedAccuracy ?? 0, fix.accuracy)
      continue
    }
    const fromAnchor = anchor && judge(anchor, fix)
    if (!fromAnchor || fromAnchor.plausible || confirms(result.candidate, fix)) {
      result.kept.push(fix)
      if (fromAnchor && !fromAnchor.plausible) result.recovered++
      anchor = fix
      result.candidate = null
      continue
    }
    result.droppedJump++
    const { metres, allowedMetres, seconds } = fromAnchor
    const worst = result.worstJump
    if (!worst || metres - allowedMetres > worst.metres - worst.allowedMetres) {
      result.worstJump = { metres, allowedMetres, seconds }
    }
    if (votes(fix)) result.candidate = fix
  }
  return result
}

// Coarse sources repeat their own wrong position, so only fixes good enough to be GNSS can agree
// against the anchor.
function votes(fix: LocationFix): boolean {
  return fix.accuracy !== null && fix.accuracy <= RECOVERY_ACCURACY_M
}

function confirms(candidate: LocationFix | null, fix: LocationFix): boolean {
  return !!candidate && votes(fix) && judge(candidate, fix).plausible
}

interface Judgement extends RejectedJump { plausible: boolean }

function judge(from: Anchor, fix: LocationFix): Judgement {
  const seconds = (fix.t - from.t) / 1000
  const metres = haversineMeters(from.lat, from.lng, fix.lat, fix.lng)
  const allowedMetres = MAX_SPEED_MPS * seconds + JUMP_FLOOR_M
  return { metres, allowedMetres, seconds, plausible: seconds > 0 && metres <= allowedMetres }
}
