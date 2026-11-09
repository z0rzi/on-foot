import { pillContent } from '../pillContent'

const trail = { name: 'Tour du Mont Blanc', metrics: { distanceMeters: 12_040, elevationGainMeters: 956 } }
const activity = { name: 'Morning walk', startedAt: new Date(2026, 9, 3, 8, 30).getTime() }
const idle = { health: { kind: 'idle' as const }, trail: null, activity: null }

describe('pillContent', () => {
  test('nothing shown and idle: no pill', () => {
    expect(pillContent({ mode: 'free', ...idle })).toEqual({ kind: 'none' })
  })

  test('a shown trail: its name, then its distance and gain', () => {
    expect(pillContent({ mode: 'trail', ...idle, trail })).toEqual({
      kind: 'trail',
      name: 'Tour du Mont Blanc',
      detail: '12.0 km · 956 m gain',
      clearLabel: 'Stop showing trail',
    })
  })

  test('a shown trail with no elevation: its distance only', () => {
    const flat = { ...trail, metrics: { distanceMeters: 800, elevationGainMeters: null } }
    expect(pillContent({ mode: 'trail', ...idle, trail: flat })).toMatchObject({ kind: 'trail', detail: '800 m' })
  })

  test('a trail still loading: no pill', () => {
    expect(pillContent({ mode: 'trail', ...idle })).toEqual({ kind: 'none' })
  })

  test('a shown activity: its name, then its date', () => {
    expect(pillContent({ mode: 'activity', ...idle, activity })).toEqual({
      kind: 'activity',
      name: 'Morning walk',
      detail: 'Oct 3, 2026',
      clearLabel: 'Stop showing activity',
    })
  })

  test('recording: the figures, with no warning while capture is well', () => {
    expect(pillContent({ mode: 'recording', health: { kind: 'recording' }, trail, activity: null })).toEqual({
      kind: 'figures',
      warning: null,
    })
  })

  test('recording with location off: the figures and the warning line', () => {
    expect(pillContent({ mode: 'recording', health: { kind: 'location-off' }, trail: null, activity: null })).toEqual({
      kind: 'figures',
      warning: { text: "Location is off · Recording continues when it's back on.", retry: false },
    })
  })

  test('recording with capture stopped: the warning line offers a retry', () => {
    expect(
      pillContent({ mode: 'recording', health: { kind: 'not-capturing', fault: 'start-failed' }, trail: null, activity: null }),
    ).toEqual({ kind: 'figures', warning: { text: 'Not recording location', retry: true } })
  })

  test('paused: the paused figures, and no warning', () => {
    expect(pillContent({ mode: 'recording', health: { kind: 'paused' }, trail, activity: null })).toEqual({ kind: 'paused' })
  })
})
