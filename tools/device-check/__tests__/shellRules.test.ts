import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isPhoneLost } from '../adbErrors'
import { nextShotNumber, shotBase, slug } from '../evidence'
import { RECORD_BUTTON_LABELS, tapTarget } from '../tapTarget'
import { parseUiDump } from '../uiDump'
import { nextFixAt } from '../walkPlan'

describe('isPhoneLost', () => {
  it.each([
    'adb: no devices/emulators found',
    'error: no devices/emulators found',
    "adb: device 'SWWC4HEIYHZPQWZX' not found",
    'adb: device offline',
    'error: device unauthorized.',
  ])('reads "%s" as the phone gone', (stderr) => {
    expect(isPhoneLost({ timedOut: false, stderr })).toBe(true)
  })

  it('reads a timeout as the phone gone', () => {
    expect(isPhoneLost({ timedOut: true, stderr: '' })).toBe(true)
  })

  it('leaves a failing command on a present phone alone', () => {
    expect(isPhoneLost({ timedOut: false, stderr: 'Error: Activity class does not exist.' })).toBe(false)
  })
})

describe('evidence numbering', () => {
  it('numbers the next shot after the highest one in the folder', () => {
    expect(nextShotNumber([])).toBe(1)
    expect(nextShotNumber(['01-map.png', '01-map.half.png', '01-map.xml', '07-sheet.png', 'DEVCHECK-climb.gpx'])).toBe(8)
  })

  it('names files NN-name, with the name made safe', () => {
    expect(shotBase(3, 'map start')).toBe('03-map-start')
    expect(shotBase(12, 'sheet/open')).toBe('12-sheet-open')
    expect(shotBase(4, 'v1.2 map')).toBe('04-v1-2-map')
  })

  it('makes one slug of any name', () => {
    expect(slug('DEVCHECK climb, then flat!')).toBe('DEVCHECK-climb-then-flat')
  })
})

describe('nextFixAt', () => {
  it('spaces fixes a second apart from the start of each send', () => {
    expect(nextFixAt(10_000, 10_120)).toBe(11_000)
  })

  it('waits a full second after a slow send, so a recovered phone gets no burst', () => {
    expect(nextFixAt(10_000, 190_000)).toBe(191_000)
  })
})

describe('tapTarget', () => {
  const idle = parseUiDump(readFileSync(join(__dirname, '..', 'fixtures', 'ui-map.xml'), 'utf8'))
  const startButton = { left: 41, top: 2021, right: 163, bottom: 2143 }

  it('takes the bounds from a fresh dump', () => {
    const target = tapTarget('Start recording', { kind: 'dump', nodes: idle, xml: '' }, null)
    expect(target).toMatchObject({ kind: 'found', remembered: false })
  })

  it('lists the labels seen when the dump has no match', () => {
    const target = tapTarget('Resume recording', { kind: 'dump', nodes: idle, xml: '' }, null)
    expect(target.kind).toBe('missing')
    expect(target.kind === 'missing' && target.reason).toContain('Start recording')
  })

  it('uses the remembered record button while recording, the one control a recording screen cannot dump', () => {
    for (const label of RECORD_BUTTON_LABELS) {
      expect(tapTarget(label, { kind: 'recording' }, startButton)).toEqual({ kind: 'found', bounds: startButton, remembered: true })
    }
  })

  it('refuses any other label while recording, and the record button when never seen', () => {
    expect(tapTarget('Center on your location', { kind: 'recording' }, startButton).kind).toBe('missing')
    const unseen = tapTarget('Pause recording (press and hold)', { kind: 'recording' }, null)
    expect(unseen.kind === 'missing' && unseen.reason).toContain('Start recording')
  })

  it('passes a failed dump on', () => {
    expect(tapTarget('Start recording', { kind: 'failed', reason: 'could not get idle state' }, null)).toEqual({
      kind: 'missing',
      reason: 'no dump: could not get idle state',
    })
  })
})
