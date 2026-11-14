import {
  nextFollowMode,
  demoteBearing,
  nextPitchOnToggle,
  clampPitch,
  followCameraProps,
  shouldShowNorthButton,
  followModeChange,
  manualPitchProps,
} from '../followCamera'

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

describe('followCameraProps', () => {
  test('off releases the camera', () =>
    expect(followCameraProps('off')).toEqual({ followUserLocation: false }))
  test('position follows location, north-up and flat', () =>
    expect(followCameraProps('position')).toEqual({
      followUserLocation: true,
      followUserMode: 'position',
      followZoomLevel: 15,
      followPitch: 0,
    }))
  test('positionAndBearing follows location + heading, tilted', () =>
    expect(followCameraProps('positionAndBearing')).toEqual({
      followUserLocation: true,
      followUserMode: 'positionAndBearing',
      followZoomLevel: 15,
      followPitch: 60,
    }))
})

describe('shouldShowNorthButton', () => {
  test('hidden within the dead-zone (<= threshold)', () => {
    expect(shouldShowNorthButton(0, 1)).toBe(false)
    expect(shouldShowNorthButton(0.5, 1)).toBe(false)
    expect(shouldShowNorthButton(359, 1)).toBe(false) // 359° = 1° off = at threshold
  })
  test('shown when rotated beyond the threshold, including wrap-around', () => {
    expect(shouldShowNorthButton(2, 1)).toBe(true)
    expect(shouldShowNorthButton(-2, 1)).toBe(true)
    expect(shouldShowNorthButton(358, 1)).toBe(true) // 358° ≈ -2°
  })
  test('reads the shorter way round from north, past a half turn', () => {
    expect(shouldShowNorthButton(180, 179)).toBe(true)
    expect(shouldShowNorthButton(181, 179)).toBe(false) // 181° = 179° off
    expect(shouldShowNorthButton(-181, 179)).toBe(false)
  })
  test('a whole number of turns is north', () => {
    expect(shouldShowNorthButton(360, 0)).toBe(false)
    expect(shouldShowNorthButton(720, 0)).toBe(false)
    expect(shouldShowNorthButton(-360, 0)).toBe(false)
  })
})

describe('followModeChange', () => {
  test('position flattens the pitch and leaves no pitch control, follow drives the camera', () =>
    expect(followModeChange('position', 60)).toEqual({
      followMode: 'position',
      cameraPitch: 0,
      pitchControl: null,
    }))
  test('positionAndBearing tilts the pitch and leaves no pitch control', () =>
    expect(followModeChange('positionAndBearing', 0)).toEqual({
      followMode: 'positionAndBearing',
      cameraPitch: 60,
      pitchControl: null,
    }))
  test('off keeps the current pitch', () =>
    expect(followModeChange('off', 42)).toEqual({
      followMode: 'off',
      cameraPitch: 42,
      pitchControl: null,
    }))
})

describe('manualPitchProps', () => {
  test('a pitch control animated by a tap, follow off: the pitch, eased', () =>
    expect(manualPitchProps('off', 60, 'animated')).toEqual({ pitch: 60, animationDuration: 300 }))
  test('a pitch control dragged live, follow off: the pitch, at once', () =>
    expect(manualPitchProps('off', 42, 'live')).toEqual({ pitch: 42, animationDuration: 0 }))
  test('no pitch control since the pitch was last set otherwise: no pitch, so a follow-off sends no camera stop', () =>
    expect(manualPitchProps('off', 0, null)).toEqual({}))
  test('following: no pitch, follow drives it', () => {
    expect(manualPitchProps('position', 0, 'animated')).toEqual({})
    expect(manualPitchProps('positionAndBearing', 60, 'live')).toEqual({})
  })
})
