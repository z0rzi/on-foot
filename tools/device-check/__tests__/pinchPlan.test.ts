import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pinchScript, planPinch } from '../pinchPlan'
import { findTouchscreen, type Touchscreen } from '../touchscreen'

const display = { width: 1080, height: 2400 }
const centre = { x: 540, y: 1200 }

const gaps = (plan: ReturnType<typeof planPinch>) => plan.map(([a, b]) => (b.y - a.y) / 2)

describe('planPinch', () => {
  it('spreads two fingers apart about the point to zoom in, vertically', () => {
    const plan = planPinch('in', centre, 4, display)
    expect(gaps(plan)).toEqual([100, 175, 250, 325, 400])
    for (const [a, b] of plan) {
      expect(a.x).toBe(540)
      expect(b.x).toBe(540)
      expect((a.y + b.y) / 2).toBe(1200)
    }
  })

  it('brings them together to zoom out', () => {
    expect(gaps(planPinch('out', centre, 4, display))).toEqual([400, 325, 250, 175, 100])
  })

  it('keeps both fingers on the screen near an edge, and refuses where there is no room', () => {
    expect(gaps(planPinch('in', { x: 540, y: 300 }, 1, display))).toEqual([100, 252])
    expect(() => planPinch('in', { x: 540, y: 200 }, 1, display)).toThrow('too close to the edge')
  })

  it('refuses a point off the screen and a step count out of range', () => {
    expect(() => planPinch('in', { x: 1080, y: 1200 }, 4, display)).toThrow('off the screen')
    expect(() => planPinch('in', centre, 0, display)).toThrow('--steps')
    expect(() => planPinch('in', centre, 51, display)).toThrow('--steps')
    expect(() => planPinch('in', centre, 2.5, display)).toThrow('--steps')
  })
})

describe('pinchScript', () => {
  const panel = findTouchscreen(readFileSync(join(__dirname, '..', 'fixtures', 'getevent-pl.txt'), 'utf8'))!

  it('writes both fingers down, their moves and the lift to the panel, in its own units', () => {
    const lines = pinchScript(panel, display, planPinch('in', centre, 1, display)).split('; ')
    const ev = (codes: string) => `sendevent /dev/input/event5 ${codes}`
    expect(lines).toEqual([
      ev('3 47 0'), ev('3 57 65534'), ev('3 53 2160'), ev('3 54 4400'), ev('3 48 6'),
      ev('3 47 1'), ev('3 57 65535'), ev('3 53 2160'), ev('3 54 5200'), ev('3 48 6'),
      ev('1 330 1'), ev('0 0 0'),
      ev('3 47 0'), ev('3 53 2160'), ev('3 54 3200'),
      ev('3 47 1'), ev('3 53 2160'), ev('3 54 6400'),
      ev('0 0 0'),
      ev('3 47 0'), ev('3 57 -1'),
      ev('3 47 1'), ev('3 57 -1'),
      ev('1 330 0'), ev('0 0 0'),
    ])
  })

  it('sends pressure and leaves out BTN_TOUCH and touch size as the panel declares them', () => {
    const other: Touchscreen = {
      device: '/dev/input/event2',
      x: { min: 0, max: 1079 },
      y: { min: 0, max: 2399 },
      tracking: { min: 0, max: 15 },
      touchMajor: null,
      pressure: { min: 0, max: 255 },
      btnTouch: false,
    }
    const lines = pinchScript(other, display, planPinch('out', centre, 1, display)).split('; ')
    expect(lines.slice(0, 5)).toEqual([
      'sendevent /dev/input/event2 3 47 0',
      'sendevent /dev/input/event2 3 57 14',
      'sendevent /dev/input/event2 3 53 540',
      'sendevent /dev/input/event2 3 54 800',
      'sendevent /dev/input/event2 3 58 128',
    ])
    expect(lines.some((l) => l.endsWith(' 1 330 1') || l.endsWith(' 3 48 6'))).toBe(false)
  })
})
