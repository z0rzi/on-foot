import { bearingDegrees, positionAt, type Route } from './geometry'

// `fast` is the highest pace the app still records as a walk along the route: at the 10 m distance
// interval every second fix is kept, so recorded points are 16 m apart, well inside the trail
// match's 25 m radius on a fold. The jump rule (60 m per second-apart fix) is not the limit. The
// cross-check test against the app's fix gate and trail matching holds this number honest.
export const PACES = { walk: 1.4, fast: 8 } as const

export interface Place { mark: number; offset: number }

export interface Fix {
  lat: number
  lng: number
  ele: number | null
  accuracy: number
  // Null on a standing fix, so Appium's repeat of it reads as standing still.
  speed: number | null
  bearing: number | null
  mark: number
  offset: number
}

const PACE_CHOICES = `walk (${PACES.walk} m/s), fast (${PACES.fast} m/s) or a speed in m/s`

export function parsePace(value: string | undefined): number {
  if (value === undefined) throw new Error(`a move needs --pace: ${PACE_CHOICES}`)
  if (value === 'walk' || value === 'fast') return PACES[value]
  const speed = Number(value)
  if (!Number.isFinite(speed) || speed <= 0) throw new Error(`pace "${value}" is not one of ${PACE_CHOICES}`)
  return speed
}

// A standing fix at the place: a jump, or the last fix of a move.
export function planJump(route: Route, to: Place, accuracy: number): Fix {
  return { ...positionAt(route, to.mark, to.offset), accuracy, speed: null, bearing: null, ...to }
}

// One fix a second, `speed` metres apart: first sideways at the starting mark to the new offset,
// then along the route at that offset. The last fix lands exactly on `to` and stands.
export function planMove(route: Route, from: Place, to: Place, speed: number, accuracy: number): Fix[] {
  const sideways = Math.abs(to.offset - from.offset)
  const along = Math.abs(to.mark - from.mark)
  const total = sideways + along
  const placeAt = (d: number): Place =>
    d <= sideways
      ? { mark: from.mark, offset: from.offset + Math.sign(to.offset - from.offset) * d }
      : { mark: from.mark + Math.sign(to.mark - from.mark) * (d - sideways), offset: to.offset }
  const steps = Math.ceil(total / speed)
  const fixes: Fix[] = []
  let previous = positionAt(route, from.mark, from.offset)
  for (let k = 1; k < steps; k++) {
    const place = placeAt(k * speed)
    const here = positionAt(route, place.mark, place.offset)
    fixes.push({ ...here, accuracy, speed, bearing: bearingDegrees(previous, here), ...place })
    previous = here
  }
  fixes.push(planJump(route, to, accuracy))
  return fixes
}

// When the next fix of a move goes: a second after this send started, or, after a send slower than
// that (a phone recovered from a drop), a second after it ended, so the walk resumes at its pace.
export function nextFixAt(sendStarted: number, sendEnded: number): number {
  return sendEnded - sendStarted < 1000 ? sendStarted + 1000 : sendEnded + 1000
}

// The extras of Appium Settings' location service for one fix.
export function fixIntentExtras(fix: Fix): string[] {
  const extras = [
    '--es', 'latitude', fix.lat.toFixed(7),
    '--es', 'longitude', fix.lng.toFixed(7),
    '--es', 'accuracy', String(fix.accuracy),
  ]
  if (fix.ele !== null) extras.push('--es', 'altitude', fix.ele.toFixed(1))
  if (fix.speed !== null && fix.bearing !== null) extras.push('--es', 'speed', String(fix.speed), '--es', 'bearing', fix.bearing.toFixed(1))
  return extras
}
