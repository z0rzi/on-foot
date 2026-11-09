import AsyncStorage from '@react-native-async-storage/async-storage'
import { nextPaceSpeedMode, usePreferencesStore, ELEVATION_SMOOTHING_PRESETS } from '../preferencesStore'

describe('nextPaceSpeedMode', () => {
  it('flips pace to speed and back', () => {
    expect(nextPaceSpeedMode('pace')).toBe('speed')
    expect(nextPaceSpeedMode('speed')).toBe('pace')
  })
})

beforeEach(() => usePreferencesStore.setState({ elevationSmoothingMeters: 50 }))

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

describe('persisted state', () => {
  it('a write stores the pace/speed mode and the smoothing, nothing else', () => {
    jest.mocked(AsyncStorage.setItem).mockClear()
    usePreferencesStore.getState().setElevationSmoothing(100)
    const [key, json] = jest.mocked(AsyncStorage.setItem).mock.calls.at(-1)!
    expect(key).toBe('onfoot-preferences')
    expect(JSON.parse(json).state).toEqual({ paceSpeedMode: 'pace', elevationSmoothingMeters: 100 })
  })
})
