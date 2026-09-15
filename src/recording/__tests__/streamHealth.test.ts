import { recordingHealthFor, recordingStatusText } from '../streamHealth'

describe('recordingHealthFor', () => {
  it('claims nothing while idle or paused, whatever was observed', () => {
    expect(recordingHealthFor({ phase: 'idle', locationAvailable: false, captureFault: 'start-failed' })).toEqual({ kind: 'inactive' })
    expect(recordingHealthFor({ phase: 'paused', locationAvailable: false, captureFault: 'permission-missing' })).toEqual({ kind: 'inactive' })
  })
  it('names location off as the cause, even when a capture fault is also recorded', () => {
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: false, captureFault: null })).toEqual({ kind: 'location-off' })
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: false, captureFault: 'start-failed' })).toEqual({ kind: 'location-off' })
  })
  it('reports a capture fault while a provider is available', () => {
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: true, captureFault: 'start-failed' })).toEqual({ kind: 'not-capturing', fault: 'start-failed' })
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: null, captureFault: 'permission-missing' })).toEqual({ kind: 'not-capturing', fault: 'permission-missing' })
  })
  it('claims recording when nothing is known to be wrong', () => {
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: true, captureFault: null })).toEqual({ kind: 'recording' })
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: null, captureFault: null })).toEqual({ kind: 'recording' })
  })
})

describe('recordingStatusText', () => {
  it('keeps the paused and recording labels', () => {
    expect(recordingStatusText('paused', { kind: 'inactive' })).toEqual({ title: '⏸ Paused', detail: null })
    expect(recordingStatusText('recording', { kind: 'recording' })).toEqual({ title: '● Recording', detail: null })
  })
  it('explains location off', () => {
    expect(recordingStatusText('recording', { kind: 'location-off' })).toEqual({
      title: 'Location is off',
      detail: "Recording continues when it's back on.",
    })
  })
  it('explains a missing permission, and gives no detail for a failed start', () => {
    expect(recordingStatusText('recording', { kind: 'not-capturing', fault: 'permission-missing' })).toEqual({
      title: 'Not recording location',
      detail: 'Allow location access for On Foot in Settings.',
    })
    expect(recordingStatusText('recording', { kind: 'not-capturing', fault: 'start-failed' })).toEqual({
      title: 'Not recording location',
      detail: null,
    })
  })
})
