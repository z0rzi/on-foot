import { serial, shell } from './adb'
import { pinchScript, planPinch, type Point } from './pinchPlan'
import { displaySize, refuseWhileMoving, requireForeground } from './screen'
import { findTouchscreen } from './touchscreen'

const PINCH_TIMEOUT_MS = 30_000

export async function zoom(direction: 'in' | 'out', at: Point | undefined, steps: number): Promise<string> {
  refuseWhileMoving(await serial(), 'zoom')
  await requireForeground()
  const display = await displaySize()
  const panel = findTouchscreen(await shell('getevent -pl'))
  if (!panel) throw new Error('no multitouch touchscreen in `getevent -pl` (a device with ABS_MT_SLOT, ABS_MT_TRACKING_ID and ABS_MT_POSITION_X/Y)')
  const point = at ?? { x: Math.round(display.width / 2), y: Math.round(display.height / 2) }
  const plan = planPinch(direction, point, steps, display)
  await requireForeground()
  await shell(pinchScript(panel, display, plan), PINCH_TIMEOUT_MS)
  const [first, last] = [plan[0], plan[plan.length - 1]]
  return `pinched ${direction} at ${point.x},${point.y}: fingers ${first[1].y - first[0].y} px to ${last[1].y - last[0].y} px apart in ${steps} steps, on ${panel.device}`
}
