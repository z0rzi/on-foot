import {
  nextFollowMode,
  demoteBearing,
  nextPitchOnToggle,
  clampPitch,
  pitchForFollowMode,
  followCameraProps,
  satelliteToggleTarget,
  resolveQuickSwitch,
  normalizeDeg,
  shouldShowNorthButton,
  followModeChange,
  useMapStore,
} from '../mapStore'

// Mirrors the provider's style list shape (id + semantic satellite flag). The store logic
// operates on this, never on a hardcoded provider style id, preserving the seam.
const STYLES = [
  { id: 'standard' },
  { id: 'satellite', satellite: true },
  { id: 'outdoors' },
]

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

describe('satelliteToggleTarget', () => {
  test('non-satellite layer -> satellite', () =>
    expect(satelliteToggleTarget('standard', STYLES)).toBe('satellite'))
  test('another non-satellite layer -> satellite', () =>
    expect(satelliteToggleTarget('outdoors', STYLES)).toBe('satellite'))
  test('satellite -> first non-satellite in the list', () =>
    expect(satelliteToggleTarget('satellite', STYLES)).toBe('standard'))
  test('no satellite in list -> falls back to current id', () =>
    expect(satelliteToggleTarget('standard', [{ id: 'standard' }])).toBe('standard'))
  test('only-satellite list -> falls back to current id', () =>
    expect(satelliteToggleTarget('satellite', [{ id: 'satellite', satellite: true }])).toBe('satellite'))
})

describe('resolveQuickSwitch', () => {
  test('valid, different, in-list previous wins', () =>
    expect(resolveQuickSwitch('standard', 'outdoors', STYLES)).toBe('outdoors'))
  test('null previous falls through to the satellite toggle', () =>
    expect(resolveQuickSwitch('standard', null, STYLES)).toBe('satellite'))
  test('previous equal to current falls through to the satellite toggle', () =>
    expect(resolveQuickSwitch('satellite', 'satellite', STYLES)).toBe('standard'))
  test('previous absent from the list falls through to the satellite toggle', () =>
    expect(resolveQuickSwitch('standard', 'ghost', STYLES)).toBe('satellite'))
})

describe('normalizeDeg', () => {
  test('passes through in-range angles', () => {
    expect(normalizeDeg(0)).toBe(0)
    expect(normalizeDeg(90)).toBe(90)
    expect(normalizeDeg(180)).toBe(180)
    expect(normalizeDeg(-1)).toBe(-1)
  })
  test('wraps out-of-range angles into (-180, 180]', () => {
    expect(normalizeDeg(181)).toBe(-179)
    expect(normalizeDeg(359)).toBe(-1)
    expect(normalizeDeg(360)).toBe(0)
    expect(normalizeDeg(720)).toBe(0)
  })
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
})

describe('followModeChange', () => {
  test('position flattens pitch and animates', () =>
    expect(followModeChange('position', 60)).toEqual({
      followMode: 'position',
      cameraPitch: 0,
      pitchAnimated: true,
    }))
  test('positionAndBearing tilts pitch and animates', () =>
    expect(followModeChange('positionAndBearing', 0)).toEqual({
      followMode: 'positionAndBearing',
      cameraPitch: 60,
      pitchAnimated: true,
    }))
})

describe('store actions', () => {
  beforeEach(() => {
    useMapStore.setState({
      followMode: 'off',
      mapStyleId: 'standard',
      previousMapStyleId: null,
      selectedTrailId: null,
      cameraPitch: 0,
      pitchAnimated: false,
      cameraHeading: 0,
      northResetNonce: 0,
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
  test('setCameraHeading updates cameraHeading', () => {
    useMapStore.getState().setCameraHeading(42)
    expect(useMapStore.getState().cameraHeading).toBe(42)
  })
  test('northPressed from compass follow demotes to position, flattening pitch, without bumping the nonce', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', cameraPitch: 60, northResetNonce: 0 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('position')
    // Pitch must flatten so the 2D/3D label stays in sync with the now-flat follow camera.
    expect(useMapStore.getState().cameraPitch).toBe(0)
    expect(useMapStore.getState().pitchAnimated).toBe(true)
    expect(useMapStore.getState().northResetNonce).toBe(0)
  })
  test('northPressed while off bumps the reset nonce without changing follow', () => {
    useMapStore.setState({ followMode: 'off', northResetNonce: 0 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().northResetNonce).toBe(1)
  })
  test('northPressed while position bumps the reset nonce (harmless)', () => {
    useMapStore.setState({ followMode: 'position', northResetNonce: 5 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().northResetNonce).toBe(6)
  })
  test('setMapStyle records the outgoing style as previous on change', () => {
    useMapStore.getState().setMapStyle('satellite')
    expect(useMapStore.getState().mapStyleId).toBe('satellite')
    expect(useMapStore.getState().previousMapStyleId).toBe('standard')
  })
  test('setMapStyle leaves previous untouched when the style is unchanged', () => {
    useMapStore.setState({ previousMapStyleId: 'outdoors' })
    useMapStore.getState().setMapStyle('standard')
    expect(useMapStore.getState().mapStyleId).toBe('standard')
    expect(useMapStore.getState().previousMapStyleId).toBe('outdoors')
  })
  test('quickSwitchMapStyle swaps to the resolved target and records previous', () => {
    // No history -> satellite toggle from the non-satellite default.
    useMapStore.getState().quickSwitchMapStyle(STYLES)
    expect(useMapStore.getState().mapStyleId).toBe('satellite')
    expect(useMapStore.getState().previousMapStyleId).toBe('standard')
  })
  test('quickSwitchMapStyle A/B-toggles between the two most-recent layers', () => {
    useMapStore.setState({ mapStyleId: 'satellite', previousMapStyleId: 'standard' })
    useMapStore.getState().quickSwitchMapStyle(STYLES)
    expect(useMapStore.getState().mapStyleId).toBe('standard')
    expect(useMapStore.getState().previousMapStyleId).toBe('satellite')
    useMapStore.getState().quickSwitchMapStyle(STYLES)
    expect(useMapStore.getState().mapStyleId).toBe('satellite')
    expect(useMapStore.getState().previousMapStyleId).toBe('standard')
  })
  test('quickSwitchMapStyle is a no-op when the resolved target equals the current style', () => {
    useMapStore.setState({ mapStyleId: 'standard', previousMapStyleId: null })
    useMapStore.getState().quickSwitchMapStyle([{ id: 'standard' }])
    expect(useMapStore.getState().mapStyleId).toBe('standard')
    expect(useMapStore.getState().previousMapStyleId).toBeNull()
  })
  test('previousMapStyleId is session-only (not persisted)', () => {
    const partialize = useMapStore.persist.getOptions().partialize!
    const partial = partialize({ ...useMapStore.getState() } as any)
    expect(partial).not.toHaveProperty('previousMapStyleId')
    expect(partial).toEqual({ mapStyleId: useMapStore.getState().mapStyleId })
  })
})
