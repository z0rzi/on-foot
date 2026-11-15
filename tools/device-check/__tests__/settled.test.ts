import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screenAgrees, targetAgrees } from '../settled'
import { parseUiDump } from '../uiDump'

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8')
const read = (name: string) => parseUiDump(fixture(name))

describe('the settled rule', () => {
  const map = read('server-map-idle.xml')

  it('takes two equal reads as agreeing, on the target and on the whole screen', () => {
    expect(targetAgrees('Start recording', map, read('server-map-idle.xml'))).toEqual({ left: 48, top: 1890, right: 192, bottom: 2034 })
    expect(screenAgrees(map, read('server-map-idle.xml'))).toBe(true)
  })

  const PAUSE = 'Pause recording (press and hold)'
  const cardClosed = fixture('server-recording-card-closed.xml')

  it('takes a target that moved between the reads as not agreeing', () => {
    expect(targetAgrees(PAUSE, read('server-recording-card-closed.xml'), read('server-recording-card-open.xml'))).toBeNull()
    expect(screenAgrees(read('server-recording-card-closed.xml'), read('server-recording-card-open.xml'))).toBe(false)
  })

  it('takes a target that is not in both reads as not agreeing', () => {
    expect(targetAgrees(PAUSE, map, read('server-recording-card-closed.xml'))).toBeNull()
    expect(targetAgrees(PAUSE, read('server-recording-card-closed.xml'), map)).toBeNull()
  })

  it('lets the recording clock tick under a still target, and not under the whole screen', () => {
    const second = cardClosed.replace('text="0:15"', 'text="0:16"')
    expect(second).not.toBe(cardClosed)
    expect(targetAgrees(PAUSE, parseUiDump(cardClosed), parseUiDump(second))).not.toBeNull()
    expect(screenAgrees(parseUiDump(cardClosed), parseUiDump(second))).toBe(false)
  })

  it('holds a sheet control that is still sliding in, and takes it once the sheet stopped', () => {
    const opening = read('server-layers-sheet-opening.xml')
    const open = read('server-layers-sheet-open.xml')
    expect(targetAgrees('Satellite map layer', opening, open)).toBeNull()
    expect(screenAgrees(opening, open)).toBe(false)
    expect(targetAgrees('Satellite map layer', open, read('server-layers-sheet-open.xml'))).toEqual({ left: 388, top: 1473, right: 692, bottom: 1838 })
  })
})
