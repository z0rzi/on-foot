import { recordingHealthFor, recordingWarning } from '../streamHealth'

describe('recordingHealthFor', () => {
  it('claims idle or paused, whatever was observed', () => {
    expect(recordingHealthFor({ phase: 'idle', locationAvailable: false, stream: { kind: 'faulted', fault: 'start-failed' } })).toEqual({ kind: 'idle' })
    expect(recordingHealthFor({ phase: 'paused', locationAvailable: false, stream: { kind: 'faulted', fault: 'permission-missing' } })).toEqual({ kind: 'paused' })
  })
  it('names location off as the cause, even when a capture fault is also recorded', () => {
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: false, stream: { kind: 'stopped' } })).toEqual({ kind: 'location-off' })
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: false, stream: { kind: 'faulted', fault: 'start-failed' } })).toEqual({ kind: 'location-off' })
  })
  it('reports a capture fault while a provider is available', () => {
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: true, stream: { kind: 'faulted', fault: 'start-failed' } })).toEqual({ kind: 'not-capturing', fault: 'start-failed' })
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: null, stream: { kind: 'faulted', fault: 'permission-missing' } })).toEqual({ kind: 'not-capturing', fault: 'permission-missing' })
  })
  it('claims recording when nothing is known to be wrong', () => {
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: true, stream: { kind: 'live' } })).toEqual({ kind: 'recording' })
    expect(recordingHealthFor({ phase: 'recording', locationAvailable: null, stream: { kind: 'stopped' } })).toEqual({ kind: 'recording' })
  })
})

describe('recordingWarning', () => {
  it('says nothing while all is well, idle or paused', () => {
    expect(recordingWarning({ kind: 'idle' })).toBeNull()
    expect(recordingWarning({ kind: 'paused' })).toBeNull()
    expect(recordingWarning({ kind: 'recording' })).toBeNull()
  })
  it('explains location off, with nothing to retry', () => {
    expect(recordingWarning({ kind: 'location-off' })).toEqual({
      text: "Location is off · Recording continues when it's back on.",
      retry: false,
    })
  })
  it('explains a missing permission, and offers a retry', () => {
    expect(recordingWarning({ kind: 'not-capturing', fault: 'permission-missing' })).toEqual({
      text: 'Not recording location · Allow location access for On Foot in Settings.',
      retry: true,
    })
  })
  it('names no cause for a failed start, and offers a retry', () => {
    expect(recordingWarning({ kind: 'not-capturing', fault: 'start-failed' })).toEqual({
      text: 'Not recording location',
      retry: true,
    })
  })
})
