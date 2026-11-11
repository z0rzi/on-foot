import { headingReading, headingTick, metresMovedSince, startHeadingMonitor } from '../headingMonitor'

const T0 = 1_000_000
const S = 1000
const MIN = 60 * S

type Monitor = ReturnType<typeof startHeadingMonitor>
const moved = (metres: number) => () => metres
const fed = (monitor: Monitor, readings: [t: number, degrees: number][], accuracy = 3) =>
  readings.reduce((m, [t, degrees]) => headingReading(m, { t, degrees, accuracy }).monitor, monitor)
const messages = (step: ReturnType<typeof headingTick>) => step.entries.map((e) => e.message)
const sampleAfter = (degrees: number[]) => {
  const monitor = fed(startHeadingMonitor(T0), degrees.map((d, i) => [T0 + (i + 1) * S, d]))
  return headingTick(monitor, T0 + 5 * MIN, moved(0)).entries[0].detail
}

describe('metresMovedSince', () => {
  // 0.0009° of latitude is 100 m.
  const point = (t: number, lat: number, segment = 0) => ({ lat, lng: 6, ele: null, t, segment })
  test('adds the steps taken since the instant', () => {
    const points = [point(T0 - 30 * S, 45), point(T0, 45.0009), point(T0 + 30 * S, 45.0018)]
    expect(Math.round(metresMovedSince(points, T0))).toBe(100)
    expect(Math.round(metresMovedSince(points, T0 - 60 * S))).toBe(200)
  })
  test('never counts the gap between two segments', () => {
    const points = [point(T0, 45, 0), point(T0 + 10 * S, 45.0009, 1), point(T0 + 20 * S, 45.0018, 1)]
    expect(Math.round(metresMovedSince(points, T0))).toBe(100)
  })
  test('is zero with no point since the instant', () => {
    expect(metresMovedSince([point(T0 - S, 45)], T0)).toBe(0)
    expect(metresMovedSince([], T0)).toBe(0)
  })
})

describe('the stall rule', () => {
  test('a turning compass under a moving walker is not stalled', () => {
    const monitor = fed(startHeadingMonitor(T0), [[T0 + 10 * S, 10], [T0 + 40 * S, 80], [T0 + 65 * S, 200]])
    expect(headingTick(monitor, T0 + 70 * S, moved(120)).entries).toEqual([])
  })

  test('a slowly turning compass, one update per minute, is not stalled', () => {
    let monitor = startHeadingMonitor(T0)
    for (let minute = 1; minute <= 4; minute++) {
      const at = T0 + minute * 50 * S
      monitor = headingReading(monitor, { t: at, degrees: 90 + 2 * minute, accuracy: 3 }).monitor
      const tick = headingTick(monitor, at + 45 * S, moved(90))
      expect(tick.entries).toEqual([])
      monitor = tick.monitor
    }
  })

  test('a silent compass under a walker who moved 50 m is stalled, said once', () => {
    const first = headingTick(startHeadingMonitor(T0), T0 + 61 * S, moved(64.4))
    expect(first.entries).toEqual([
      { level: 'warn', message: 'heading stalled', detail: { silentS: 61, movedM: 64 } },
    ])
    expect(headingTick(first.monitor, T0 + 71 * S, moved(80)).entries).toEqual([])
    expect(headingTick(first.monitor, T0 + 10 * MIN, moved(900)).entries.map((e) => e.message)).not.toContain(
      'heading stalled',
    )
  })

  test('silence and distance are both counted from the last update', () => {
    const monitor = fed(startHeadingMonitor(T0), [[T0 + 30 * S, 10], [T0 + 100 * S, 90]])
    const since = jest.fn(() => 70)
    const tick = headingTick(monitor, T0 + 170 * S, since)
    expect(since).toHaveBeenCalledWith(T0 + 100 * S)
    expect(tick.entries).toEqual([
      { level: 'warn', message: 'heading stalled', detail: { silentS: 70, movedM: 70 } },
    ])
  })

  test('a slow walker is stalled once 50 m are reached, however long that takes', () => {
    const atOneMinute = headingTick(startHeadingMonitor(T0), T0 + 1 * MIN, moved(17))
    expect(atOneMinute.entries).toEqual([])
    const atTwoMinutes = headingTick(atOneMinute.monitor, T0 + 2 * MIN, moved(34))
    expect(atTwoMinutes.entries).toEqual([])
    expect(headingTick(atTwoMinutes.monitor, T0 + 3 * MIN, moved(51)).entries).toEqual([
      { level: 'warn', message: 'heading stalled', detail: { silentS: 180, movedM: 51 } },
    ])
  })

  test('a walker standing still is never stalled, however long the compass is silent', () => {
    expect(headingTick(startHeadingMonitor(T0), T0 + 4 * MIN, moved(49)).entries).toEqual([])
  })

  test('nothing is said in the first 60 s of silence', () => {
    expect(headingTick(startHeadingMonitor(T0), T0 + 59 * S, moved(200)).entries).toEqual([])
  })

  test('the next update after a stall is a resume, said once', () => {
    const stalled = headingTick(startHeadingMonitor(T0), T0 + 61 * S, moved(64)).monitor
    const resumed = headingReading(stalled, { t: T0 + 65 * S, degrees: 10, accuracy: 3 })
    expect(resumed.entries).toEqual([{ level: 'info', message: 'heading resumed' }])
    expect(headingReading(resumed.monitor, { t: T0 + 66 * S, degrees: 14, accuracy: 3 }).entries).toEqual([])
    expect(headingTick(resumed.monitor, T0 + 70 * S, moved(64)).entries).toEqual([])
  })

  test('an update with no stall before it says nothing', () => {
    expect(headingReading(startHeadingMonitor(T0), { t: T0 + S, degrees: 10, accuracy: 3 }).entries).toEqual([])
  })

  test('a stall after a resume is said again', () => {
    const stalled = headingTick(startHeadingMonitor(T0), T0 + 61 * S, moved(64)).monitor
    const resumed = headingReading(stalled, { t: T0 + 65 * S, degrees: 10, accuracy: 3 }).monitor
    expect(messages(headingTick(resumed, T0 + 130 * S, moved(64)))).toEqual(['heading stalled'])
  })
})

describe('the five-minute sample', () => {
  test('nothing before five minutes', () => {
    const monitor = fed(startHeadingMonitor(T0), [[T0 + 10 * S, 10]])
    expect(messages(headingTick(monitor, T0 + 5 * MIN - S, moved(0)))).toEqual([])
  })

  test('summarises the window: updates, spread, last accuracy, distance', () => {
    let monitor = fed(startHeadingMonitor(T0), [[T0 + 1 * MIN, 350], [T0 + 2 * MIN, 5.26]], 2)
    monitor = fed(monitor, [[T0 + 5 * MIN - S, 358]], 3)
    const since = jest.fn((t: number) => (t === T0 ? 412.6 : 0))
    const tick = headingTick(monitor, T0 + 5 * MIN, since)
    expect(tick.entries).toEqual([
      { level: 'info', message: 'heading sample', detail: { updates: 3, spreadDeg: 15.3, accuracy: 3, movedM: 413 } },
    ])
  })

  test('a window with no update has no accuracy', () => {
    const tick = headingTick(startHeadingMonitor(T0), T0 + 5 * MIN, moved(0))
    expect(tick.entries).toEqual([
      { level: 'info', message: 'heading sample', detail: { updates: 0, spreadDeg: 0, accuracy: null, movedM: 0 } },
    ])
  })

  test('the next window starts empty, at the sample', () => {
    const monitor = fed(startHeadingMonitor(T0), [[T0 + 4 * MIN + 50 * S, 10], [T0 + 4 * MIN + 55 * S, 60]])
    const first = headingTick(monitor, T0 + 5 * MIN, moved(0))
    const second = headingTick(fed(first.monitor, [[T0 + 6 * MIN, 20]]), T0 + 10 * MIN, moved(0))
    expect(second.entries).toEqual([
      { level: 'info', message: 'heading sample', detail: { updates: 1, spreadDeg: 0, accuracy: 3, movedM: 0 } },
    ])
  })

  test('the spread is the arc the headings cover, short across north', () => {
    expect(sampleAfter([10, 40, 25])).toMatchObject({ spreadDeg: 30 })
    expect(sampleAfter([350, 5, 358])).toMatchObject({ spreadDeg: 15 })
    expect(sampleAfter([0, 90, 180, 270])).toMatchObject({ spreadDeg: 270 })
    expect(sampleAfter([123])).toMatchObject({ spreadDeg: 0 })
  })
})
