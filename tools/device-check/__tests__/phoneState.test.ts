import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { classifyForeground, classifyServices, parseDisplaySize } from '../phoneState'

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8')

describe('classifyForeground', () => {
  it('knows On Foot in front', () => {
    expect(classifyForeground(fixture('top-onfoot.txt'))).toEqual({ kind: 'on-foot', activity: 'com.zorzi.onfootrn/.MainActivity' })
  })

  it('accepts the system file picker and share sheet a check opens', () => {
    expect(classifyForeground(fixture('top-picker.txt')).kind).toBe('picker')
    expect(classifyForeground(fixture('top-share-sheet.txt')).kind).toBe('share-sheet')
  })

  it('names any other app in front', () => {
    expect(classifyForeground(fixture('top-launcher.txt'))).toEqual({ kind: 'other', activity: 'bitpit.launcher/.ui.HomeActivity' })
  })

  it('is unreadable without a resumed activity', () => {
    expect(classifyForeground('').kind).toBe('unreadable')
  })
})

describe('classifyServices', () => {
  it('reads a running recording as taking fixes', () => {
    expect(classifyServices(fixture('services-recording.txt'))).toBe('taking-fixes')
  })

  it('reads a paused recording and an idle app as not taking fixes', () => {
    expect(classifyServices(fixture('services-paused.txt'))).toBe('not-taking-fixes')
    expect(classifyServices(fixture('services-idle.txt'))).toBe('not-taking-fixes')
  })

  it('is unreadable when the output is not a service dump', () => {
    expect(classifyServices('')).toBe('unreadable')
    expect(classifyServices('adb: no devices/emulators found')).toBe('unreadable')
  })
})

describe('parseDisplaySize', () => {
  it('reads the size from `wm size`', () => {
    expect(parseDisplaySize('Physical size: 1080x2400\n')).toEqual({ width: 1080, height: 2400 })
  })

  it('takes an override, the size taps and dumps are in', () => {
    expect(parseDisplaySize('Physical size: 1440x3216\nOverride size: 1080x2412\n')).toEqual({ width: 1080, height: 2412 })
  })

  it('throws on anything else', () => {
    expect(() => parseDisplaySize('')).toThrow('wm size')
  })
})
