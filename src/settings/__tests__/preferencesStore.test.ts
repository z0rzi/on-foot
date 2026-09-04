import { nextPaceSpeedMode, usePreferencesStore, ELEVATION_SMOOTHING_PRESETS } from '../preferencesStore'

describe('nextPaceSpeedMode', () => {
  it('flips pace to speed and back', () => {
    expect(nextPaceSpeedMode('pace')).toBe('speed')
    expect(nextPaceSpeedMode('speed')).toBe('pace')
  })
})

beforeEach(() => usePreferencesStore.setState({ elevationSmoothingMeters: 50, elevationGraphPlacement: 'floating' }))

describe('elevation smoothing preference', () => {
  it('defaults to 50 m', () => {
    expect(usePreferencesStore.getState().elevationSmoothingMeters).toBe(50)
  })
  it('setElevationSmoothing updates the value', () => {
    usePreferencesStore.getState().setElevationSmoothing(100)
    expect(usePreferencesStore.getState().elevationSmoothingMeters).toBe(100)
  })
  it('exposes presets including Off (0) and the 50 m default', () => {
    expect(ELEVATION_SMOOTHING_PRESETS).toContain(0)
    expect(ELEVATION_SMOOTHING_PRESETS).toContain(50)
  })
})

describe('elevation graph placement preference', () => {
  it('defaults to floating', () => {
    expect(usePreferencesStore.getState().elevationGraphPlacement).toBe('floating')
  })
  it('setElevationGraphPlacement switches to in-sheet and back', () => {
    usePreferencesStore.getState().setElevationGraphPlacement('inSheet')
    expect(usePreferencesStore.getState().elevationGraphPlacement).toBe('inSheet')
    usePreferencesStore.getState().setElevationGraphPlacement('floating')
    expect(usePreferencesStore.getState().elevationGraphPlacement).toBe('floating')
  })
})
