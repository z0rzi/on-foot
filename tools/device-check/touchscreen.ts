// The touchscreen as `getevent -pl` describes it: the input node a pinch is written to, and the
// ranges its axes report in. Nothing here knows a particular phone.
export interface AxisRange { min: number; max: number }

export interface Touchscreen {
  device: string
  x: AxisRange
  y: AxisRange
  tracking: AxisRange
  touchMajor: AxisRange | null
  pressure: AxisRange | null
  btnTouch: boolean
}

function axes(block: string): Map<string, AxisRange> {
  const found = new Map<string, AxisRange>()
  for (const [, name, min, max] of block.matchAll(/\b(ABS_MT_\w+)\s*: value -?\d+, min (-?\d+), max (-?\d+)/g)) {
    found.set(name, { min: Number(min), max: Number(max) })
  }
  return found
}

// A multitouch (protocol B) device: slots and tracking ids, so two fingers can be written. A panel
// that says it is direct (on the display) wins over one that does not.
export function findTouchscreen(geteventPl: string): Touchscreen | null {
  const candidates: { screen: Touchscreen; direct: boolean }[] = []
  for (const block of geteventPl.split(/^add device \d+: /m).slice(1)) {
    const device = block.split('\n')[0].trim()
    const abs = axes(block)
    const x = abs.get('ABS_MT_POSITION_X')
    const y = abs.get('ABS_MT_POSITION_Y')
    const tracking = abs.get('ABS_MT_TRACKING_ID')
    if (!x || !y || !tracking || !abs.has('ABS_MT_SLOT')) continue
    candidates.push({
      screen: {
        device,
        x,
        y,
        tracking,
        touchMajor: abs.get('ABS_MT_TOUCH_MAJOR') ?? null,
        pressure: abs.get('ABS_MT_PRESSURE') ?? null,
        btnTouch: /\bBTN_TOUCH\b/.test(block),
      },
      direct: /\bINPUT_PROP_DIRECT\b/.test(block),
    })
  }
  return (candidates.find((c) => c.direct) ?? candidates[0])?.screen ?? null
}

// The inverse of the platform's own mapping, which spreads the axis's max - min + 1 units over the
// display's pixels.
export function toDeviceUnits(px: number, screenPx: number, range: AxisRange): number {
  const units = range.min + Math.round((px * (range.max - range.min + 1)) / screenPx)
  return Math.min(range.max, Math.max(range.min, units))
}
