import type { DisplaySize } from './phoneState'
import { toDeviceUnits, type Touchscreen } from './touchscreen'

export interface Point { x: number; y: number }

// Each frame of a pinch: the two fingers, one above the point and one below it.
export type PinchPlan = [Point, Point][]

export const MAX_PINCH_STEPS = 50

// Half the distance between the fingers runs from a twenty-fourth to a sixth of the screen height,
// short of a margin at either edge.
export function planPinch(direction: 'in' | 'out', at: Point, steps: number, display: DisplaySize): PinchPlan {
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_PINCH_STEPS) throw new Error(`--steps must be a whole number from 1 to ${MAX_PINCH_STEPS}`)
  if (at.x < 0 || at.y < 0 || at.x >= display.width || at.y >= display.height) {
    throw new Error(`${at.x},${at.y} is off the screen (${display.width}x${display.height})`)
  }
  const near = Math.round(display.height / 24)
  const margin = Math.round(display.height / 50)
  const far = Math.min(Math.round(display.height / 6), at.y - margin, display.height - 1 - at.y - margin)
  if (far < 2 * near) throw new Error(`${at.x},${at.y} is too close to the edge for a pinch`)
  const [from, to] = direction === 'in' ? [near, far] : [far, near]
  return Array.from({ length: steps + 1 }, (_, i) => {
    const half = Math.round(from + ((to - from) * i) / steps)
    return [{ x: at.x, y: at.y - half }, { x: at.x, y: at.y + half }]
  })
}

const EV = { syn: 0, key: 1, abs: 3 }
const CODE = { slot: 0x2f, touchMajor: 0x30, x: 0x35, y: 0x36, tracking: 0x39, pressure: 0x3a, btnTouch: 0x14a }
const TOUCH_MAJOR = 6

// One `adb shell` line of `sendevent`s writing the plan to the panel as two protocol B slots.
export function pinchScript(panel: Touchscreen, display: DisplaySize, plan: PinchPlan): string {
  const lines: string[] = []
  const ev = (type: number, code: number, value: number) => lines.push(`sendevent ${panel.device} ${type} ${code} ${value}`)
  const sync = () => ev(EV.syn, 0, 0)
  const position = (p: Point) => {
    ev(EV.abs, CODE.x, toDeviceUnits(p.x, display.width, panel.x))
    ev(EV.abs, CODE.y, toDeviceUnits(p.y, display.height, panel.y))
  }
  const trackingIds = [panel.tracking.max - 1, panel.tracking.max]

  const [first, ...moves] = plan
  first.forEach((finger, slot) => {
    ev(EV.abs, CODE.slot, slot)
    ev(EV.abs, CODE.tracking, trackingIds[slot])
    position(finger)
    if (panel.touchMajor) ev(EV.abs, CODE.touchMajor, Math.min(TOUCH_MAJOR, panel.touchMajor.max))
    if (panel.pressure) ev(EV.abs, CODE.pressure, panel.pressure.min + Math.round((panel.pressure.max - panel.pressure.min) / 2))
  })
  if (panel.btnTouch) ev(EV.key, CODE.btnTouch, 1)
  sync()
  for (const fingers of moves) {
    fingers.forEach((finger, slot) => {
      ev(EV.abs, CODE.slot, slot)
      position(finger)
    })
    sync()
  }
  for (const slot of [0, 1]) {
    ev(EV.abs, CODE.slot, slot)
    ev(EV.abs, CODE.tracking, -1)
  }
  if (panel.btnTouch) ev(EV.key, CODE.btnTouch, 0)
  sync()
  return lines.join('; ')
}
