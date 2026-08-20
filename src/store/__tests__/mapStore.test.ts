import {
  nextFollowMode,
  demoteBearing,
  nextPitchOnToggle,
  clampPitch,
  pitchForFollowMode,
  followCameraProps,
  useMapStore,
} from '../mapStore'

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

describe('pitchForFollowMode', () => {
  test('position -> flat (pitchMin)', () => expect(pitchForFollowMode('position', 60)).toBe(0))
  test('positionAndBearing -> tilted (pitchToggle)', () =>
    expect(pitchForFollowMode('positionAndBearing', 0)).toBe(60))
  test('off keeps the current pitch', () => expect(pitchForFollowMode('off', 42)).toBe(42))
})

describe('followCameraProps', () => {
  test('off releases the camera', () =>
    expect(followCameraProps('off')).toEqual({ followUserLocation: false }))
  test('position follows location, north-up and flat', () =>
    expect(followCameraProps('position')).toEqual({
      followUserLocation: true,
      followUserMode: 'normal',
      followZoomLevel: 15,
      followPitch: 0,
    }))
  test('positionAndBearing follows location + heading, tilted', () =>
    expect(followCameraProps('positionAndBearing')).toEqual({
      followUserLocation: true,
      followUserMode: 'compass',
      followZoomLevel: 15,
      followPitch: 60,
    }))
})

describe('store actions', () => {
  beforeEach(() => {
    useMapStore.setState({
      followMode: 'off',
      selectedTrailId: null,
      hasZoomedToUser: false,
      cameraPitch: 0,
      pitchAnimated: false,
    })
  })
  test('defaults to position follow so the map centres on the user at launch', () => {
    // The persisted store hydrates followMode from the initializer default, not persistence.
    expect(useMapStore.getInitialState().followMode).toBe('position')
  })
  test('cycleFollowMode advances the machine and syncs the pitch label', () => {
    useMapStore.getState().cycleFollowMode()
    expect(useMapStore.getState().followMode).toBe('position')
    expect(useMapStore.getState().cameraPitch).toBe(0)
    useMapStore.getState().cycleFollowMode()
    expect(useMapStore.getState().followMode).toBe('positionAndBearing')
    expect(useMapStore.getState().cameraPitch).toBe(60)
  })
  test('disableFollow forces off without touching pitch', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', cameraPitch: 60 })
    useMapStore.getState().disableFollow()
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().cameraPitch).toBe(60)
  })
  test('northPressed demotes bearing follow', () => {
    useMapStore.setState({ followMode: 'positionAndBearing' })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('position')
  })
  test('setCameraPitch sets the pitch and marks it instant', () => {
    useMapStore.setState({ pitchAnimated: true })
    useMapStore.getState().setCameraPitch(45)
    expect(useMapStore.getState().cameraPitch).toBe(45)
    expect(useMapStore.getState().pitchAnimated).toBe(false)
  })
  test('setCameraPitchAnimated sets the pitch and marks it animated', () => {
    useMapStore.getState().setCameraPitchAnimated(60)
    expect(useMapStore.getState().cameraPitch).toBe(60)
    expect(useMapStore.getState().pitchAnimated).toBe(true)
  })
})
