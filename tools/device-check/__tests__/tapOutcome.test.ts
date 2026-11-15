import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { outcomeAtCap, outcomeReport, tapOutcome, withoutLabels } from '../tapOutcome'
import { parseUiDump } from '../uiDump'

const read = (name: string) => parseUiDump(readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8'))

const map = read('server-map-idle.xml')
const recording = read('server-recording-card-closed.xml')
const PAUSE = 'Pause recording (press and hold)'

describe('the tap outcome', () => {
  it('has the named label appear on the first read that holds it', () => {
    const judge = tapOutcome({ label: PAUSE, gone: false }, map)
    expect(judge(map, null)).toBeNull()
    expect(judge(recording, map)).toEqual({ kind: 'appeared', label: PAUSE, nodes: recording })
    expect(outcomeReport({ kind: 'appeared', label: PAUSE, nodes: recording }, 1.24)).toMatch(/^"Pause recording \(press and hold\)" appeared after 1\.2 s\nlabels: .*Pause recording \(press and hold\)/)
  })

  it('has the named label go on the first read without it', () => {
    const judge = tapOutcome({ label: 'Start recording', gone: true }, map)
    expect(judge(map, null)).toBeNull()
    expect(judge(recording, map)?.kind).toBe('gone')
  })

  it('takes a screen that settled as it was before the tap for nothing changed', () => {
    const judge = tapOutcome(null, map)
    expect(judge(read('server-map-idle.xml'), null)).toBeNull()
    const outcome = judge(read('server-map-idle.xml'), map)
    expect(outcome?.kind).toBe('nothing-changed')
    expect(outcomeReport(outcome!, 0.7)).toMatch(/^nothing changed \(settled after 0\.7 s\)\nlabels: .*Start recording/)
  })

  it('reports the labels of the screen the tap settled on', () => {
    const judge = tapOutcome(null, map)
    expect(judge(recording, map)).toBeNull()
    const outcome = judge(read('server-recording-card-closed.xml'), recording)
    expect(outcome?.kind).toBe('settled')
    expect(outcomeReport(outcome!, 0.9)).toMatch(/^settled after 0\.9 s\nlabels: .*Pause recording/)
  })

  it('fails a named outcome that did not come, with the time waited and the labels last seen', () => {
    const atCap = outcomeAtCap({ label: 'Resume recording', gone: false }, 10, { read: recording, last: 'labels seen: 0:15 | Pause recording (press and hold)' })
    expect(atCap).toEqual({ kind: 'failed', reason: '"Resume recording" not there after 10 s; labels seen: 0:15 | Pause recording (press and hold)' })
  })

  it('reports a screen that never settled as its last read, without failing', () => {
    const atCap = outcomeAtCap(null, 3, { read: recording, last: 'labels seen: …' })
    expect(atCap.kind).toBe('report')
    expect(atCap.kind === 'report' && atCap.report).toMatch(/^not settled after 3 s\nlabels: .*Pause recording/)
  })

  it('says what it last saw when no read came at all', () => {
    const atCap = outcomeAtCap(null, 3, { read: null, last: 'cannot tell which app is in front (screen off or locked?)' })
    expect(atCap).toEqual({ kind: 'report', report: 'not settled after 3 s; cannot tell which app is in front (screen off or locked?)' })
  })
})

describe('a tap report without its labels', () => {
  it('keeps what the tap did and caused, and drops the labels of the screen it ended on', () => {
    const picker = read('server-picker-gpx.xml')
    const report = `tapped "Add a GPX file" at 540,300, still after 0.5 s\n${outcomeReport({ kind: 'appeared', label: 'DEVCHECK-a.gpx', nodes: picker }, 1.2)}`
    expect(withoutLabels(report)).toBe('tapped "Add a GPX file" at 540,300, still after 0.5 s\n"DEVCHECK-a.gpx" appeared after 1.2 s')
  })
})
