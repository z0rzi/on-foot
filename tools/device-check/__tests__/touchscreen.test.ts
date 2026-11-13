import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findTouchscreen, toDeviceUnits } from '../touchscreen'

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8')

describe('findTouchscreen', () => {
  it('finds the multitouch panel and its position ranges among the input devices', () => {
    expect(findTouchscreen(fixture('getevent-pl.txt'))).toEqual({
      device: '/dev/input/event5',
      x: { min: 0, max: 4319 },
      y: { min: 0, max: 9599 },
      tracking: { min: 0, max: 65535 },
      touchMajor: { min: 0, max: 255 },
      pressure: null,
      btnTouch: true,
    })
  })

  it('finds none when no device has slots and tracking ids', () => {
    const hoverOnly = fixture('getevent-pl.txt').split('add device 4:')[0]
    expect(findTouchscreen(hoverOnly)).toBeNull()
    expect(findTouchscreen('')).toBeNull()
  })
})

describe('toDeviceUnits', () => {
  it('scales a screen pixel to the axis range the panel reports', () => {
    expect(toDeviceUnits(540, 1080, { min: 0, max: 4319 })).toBe(2160)
    expect(toDeviceUnits(0, 1080, { min: 0, max: 4319 })).toBe(0)
    expect(toDeviceUnits(1200, 2400, { min: 0, max: 1599 })).toBe(800)
  })

  it('honours an axis that does not start at zero, and stays inside it', () => {
    expect(toDeviceUnits(500, 1000, { min: 100, max: 2099 })).toBe(1100)
    expect(toDeviceUnits(1000, 1000, { min: 0, max: 4095 })).toBe(4095)
  })
})
