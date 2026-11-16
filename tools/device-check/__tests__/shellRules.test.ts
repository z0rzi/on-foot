import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isPhoneLost } from '../adbErrors'
import { nextShotNumber, shotBase, slug } from '../evidence'
import { tapTarget, targetAtCap } from '../tapTarget'
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
  const read = (name: string) => parseUiDump(readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8'))
  const idle = read('ui-map.xml')
  const PAUSE = 'Pause recording (press and hold)'
  const still = (label: string, nodes: ReturnType<typeof read>) => tapTarget(label, nodes, nodes)

  it('takes the bounds once two reads agree on them', () => {
    expect(tapTarget('Start recording', idle, null)).toBeNull()
    expect(still('Start recording', idle)).toEqual({ kind: 'still', bounds: { left: 41, top: 1966, right: 163, bottom: 2089 } })
  })

  it('waits while the target moves', () => {
    expect(tapTarget(PAUSE, read('server-recording-card-open.xml'), read('server-recording-card-closed.xml'))).toBeNull()
  })

  it('lists the labels seen when the screen settled without the target', () => {
    const target = still('Resume recording', idle)
    expect(target?.kind).toBe('missing')
    expect(target?.kind === 'missing' && target.reason).toContain('Start recording')
  })

  it('waits for a target missing from a screen still changing', () => {
    expect(tapTarget('Resume recording', idle, read('server-recording-card-closed.xml'))).toBeNull()
  })

  it('refuses a target still moving at the cap, and names a missing one', () => {
    expect(targetAtCap(PAUSE, 2, { read: read('server-recording-card-open.xml'), last: '' })).toBe(`"${PAUSE}" still moving after 2 s: not tapped`)
    expect(targetAtCap('Resume recording', 2, { read: idle, last: 'labels seen: Start recording' })).toBe('no "Resume recording" on screen after 2 s; labels seen: Start recording')
  })

  it.each([
    ['open', 'server-recording-card-open.xml'],
    ['closed', 'server-recording-card-closed.xml'],
  ])('finds every control of the recording screen by its label, the map card %s', (_, fixture) => {
    const recording = read(fixture)
    expect(still(PAUSE, recording)?.kind).toBe('still')
    expect(still('Open map layers', recording)?.kind).toBe('still')
    expect(still('Resume recording', recording)?.kind).toBe('missing')
  })

  it('finds the pause button where the map card puts it', () => {
    const at = (fixture: string) => {
      const target = still(PAUSE, read(fixture))
      return target?.kind === 'still' ? target.bounds.top : null
    }
    expect(at('server-recording-card-open.xml')).toBeLessThan(at('server-recording-card-closed.xml')!)
  })
})

describe('tapTarget on a delete confirmation', () => {
  const xml = readFileSync(join(__dirname, '..', 'fixtures', 'ui-delete-trail-dialog.xml'), 'utf8')
  const naming = (name: string) => parseUiDump(xml.replace('DEVCHECK climb', name))
  const activityDialog = (name: string) =>
    parseUiDump(
      xml
        .replace('>Delete trail<', '>Delete activity<')
        .replace('text="Delete trail"', 'text="Delete activity"')
        .replace('Delete &quot;DEVCHECK climb&quot; and its offline map? This cannot be undone.', `Are you sure you want to delete &quot;${name}&quot;? This action cannot be undone.`),
    )
  const still = (label: string, nodes: ReturnType<typeof parseUiDump>) => tapTarget(label, nodes, nodes)

  it('taps Delete on a dialog naming a DEVCHECK item', () => {
    expect(still('DELETE', naming('DEVCHECK climb'))).toEqual({ kind: 'still', bounds: { left: 780, top: 1280, right: 980, bottom: 1380 } })
    expect(still('DELETE', activityDialog('DEVCHECK walk'))?.kind).toBe('still')
  })

  it('refuses Delete on a dialog naming an item not named DEVCHECK, naming it', () => {
    expect(still('DELETE', naming('Col de la Croix'))).toEqual({
      kind: 'refused',
      reason: 'refused: the dialog deletes "Col de la Croix", not a DEVCHECK item; only DEVCHECK items are deleted',
    })
    expect(still('DELETE', activityDialog('Morning hike'))?.kind).toBe('refused')
    expect(still('DELETE', naming('DEVCHECKclimb'))?.kind).toBe('refused')
  })

  it('refuses Delete on a dialog naming no item', () => {
    expect(still('DELETE', parseUiDump(xml.replace(/&quot;/g, '')))).toEqual({
      kind: 'refused',
      reason: 'refused: the dialog names no item; only DEVCHECK items are deleted',
    })
  })

  it("lets Cancel close the owner's dialog", () => {
    expect(still('CANCEL', naming('Col de la Croix'))?.kind).toBe('still')
  })
})
