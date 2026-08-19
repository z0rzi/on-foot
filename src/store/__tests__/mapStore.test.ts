import { nextFollowMode, demoteBearing, nextPitchOnToggle, clampPitch, useMapStore } from '../mapStore'

describe('nextFollowMode', () => {
  test('off -> position', () => expect(nextFollowMode('off')).toBe('position'))
  test('position -> positionAndBearing', () =>
    expect(nextFollowMode('position')).toBe('positionAndBearing'))
  test('positionAndBearing -> position', () =>
    expect(nextFollowMode('positionAndBearing')).toBe('position'))
})

describe('demoteBearing', () => {
  test('positionAndBearing -> position', () =>
    expect(demoteBearing('positionAndBearing')).toBe('position'))
  test('position unchanged', () => expect(demoteBearing('position')).toBe('position'))
  test('off unchanged', () => expect(demoteBearing('off')).toBe('off'))
})

describe('nextPitchOnToggle', () => {
  test('flat (0) -> pitchToggle (60)', () => expect(nextPitchOnToggle(0)).toBe(60))
  test('at pitchToggle (60) -> flat (0)', () => expect(nextPitchOnToggle(60)).toBe(0))
  test('any tilt above pitchMin (30) -> flat (0)', () => expect(nextPitchOnToggle(30)).toBe(0))
})

describe('clampPitch', () => {
  test('clamps below pitchMin up to 0', () => expect(clampPitch(-10)).toBe(0))
  test('clamps above pitchMax down to 85', () => expect(clampPitch(100)).toBe(85))
  test('passes through in-range values', () => expect(clampPitch(40)).toBe(40))
})

describe('store actions', () => {
  beforeEach(() => {
    useMapStore.setState({ followMode: 'off', selectedTrailId: null, hasZoomedToUser: false, cameraPitch: 0 })
  })
  test('cycleFollowMode advances the machine', () => {
    useMapStore.getState().cycleFollowMode()
    expect(useMapStore.getState().followMode).toBe('position')
    useMapStore.getState().cycleFollowMode()
    expect(useMapStore.getState().followMode).toBe('positionAndBearing')
  })
  test('disableFollow forces off', () => {
    useMapStore.setState({ followMode: 'positionAndBearing' })
    useMapStore.getState().disableFollow()
    expect(useMapStore.getState().followMode).toBe('off')
  })
  test('northPressed demotes bearing follow', () => {
    useMapStore.setState({ followMode: 'positionAndBearing' })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('position')
  })
  test('setCameraPitch sets the pitch', () => {
    useMapStore.getState().setCameraPitch(45)
    expect(useMapStore.getState().cameraPitch).toBe(45)
  })
})
