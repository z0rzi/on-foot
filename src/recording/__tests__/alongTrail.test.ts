import { alongTrailChanged, alongTrailId, selectTrailWhileRecording } from '../alongTrail'

describe('selectTrailWhileRecording', () => {
  test('recording along no trail: the recording becomes along the new one', () => {
    expect(selectTrailWhileRecording(null, 4)).toBe('along')
  })

  test('recording along another trail: asks first', () => {
    expect(selectTrailWhileRecording(3, 4)).toBe('ask')
  })

  test('the same trail: shown, nothing changes', () => {
    expect(selectTrailWhileRecording(4, 4)).toBe('same')
  })
})

describe('alongTrailId', () => {
  test("the trail shown while recording is the recording's trail", () => {
    expect(alongTrailId('recording', { kind: 'trail', id: 4 })).toBe(4)
    expect(alongTrailId('paused', { kind: 'trail', id: 4 })).toBe(4)
  })

  test("no recording, no recording's trail", () => {
    expect(alongTrailId('idle', { kind: 'trail', id: 4 })).toBeNull()
  })

  test('recording with nothing shown is along no trail', () => {
    expect(alongTrailId('recording', null)).toBeNull()
  })
})

describe('alongTrailChanged', () => {
  test('a different trail during the same recording is a change', () => {
    expect(alongTrailChanged({ phase: 'recording', trailId: 3 }, { phase: 'recording', trailId: 4 })).toBe(true)
  })

  test('dropping or gaining the trail mid-recording is a change', () => {
    expect(alongTrailChanged({ phase: 'paused', trailId: 3 }, { phase: 'paused', trailId: null })).toBe(true)
    expect(alongTrailChanged({ phase: 'recording', trailId: null }, { phase: 'recording', trailId: 4 })).toBe(true)
  })

  test('pausing keeps the trail', () => {
    expect(alongTrailChanged({ phase: 'recording', trailId: 3 }, { phase: 'paused', trailId: 3 })).toBe(false)
  })

  test('starting or ending a recording is not a change of its trail', () => {
    expect(alongTrailChanged({ phase: 'idle', trailId: null }, { phase: 'recording', trailId: 3 })).toBe(false)
    expect(alongTrailChanged({ phase: 'paused', trailId: 3 }, { phase: 'idle', trailId: null })).toBe(false)
  })
})
