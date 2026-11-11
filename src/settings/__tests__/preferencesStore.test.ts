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

describe('hydration', () => {
  const getItem = jest.mocked(AsyncStorage.getItem)
  const setItem = jest.mocked(AsyncStorage.setItem)
  const persisted = JSON.stringify({
    state: { paceSpeedMode: 'speed', elevationSmoothingMeters: 200 },
    version: 0,
  })
  beforeEach(() => {
    usePreferencesStore.setState({ paceSpeedMode: 'pace', elevationSmoothingMeters: 50 })
    setItem.mockClear()
  })
  afterEach(() => {
    getItem.mockReset()
    setItem.mockReset()
  })

  it('a failed hydration never writes the defaults over the stored preferences', async () => {
    getItem.mockRejectedValueOnce(new Error('storage unavailable'))
    await usePreferencesStore.persist.rehydrate()
    usePreferencesStore.getState().togglePaceSpeed()
    expect(usePreferencesStore.getState().paceSpeedMode).toBe('speed')
    expect(setItem).not.toHaveBeenCalled()
  })
  it('nothing is written while hydration is pending, and writes resume once it lands', async () => {
    let land: (value: string) => void = () => {}
    getItem.mockReturnValueOnce(new Promise<string>((resolve) => { land = resolve }))
    const hydration = usePreferencesStore.persist.rehydrate()
    usePreferencesStore.getState().setElevationSmoothing(100)
    expect(usePreferencesStore.getState().elevationSmoothingMeters).toBe(100)
    expect(setItem).not.toHaveBeenCalled()
    land(persisted)
    await hydration
    usePreferencesStore.getState().setElevationSmoothing(25)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(setItem.mock.calls[0][1]).state).toEqual({
      paceSpeedMode: 'speed',
      elevationSmoothingMeters: 25,
    })
  })
})
