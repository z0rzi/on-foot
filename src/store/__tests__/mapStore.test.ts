import { nextFollowMode, demoteBearing, useMapStore } from '../mapStore'

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

describe('store actions', () => {
  beforeEach(() => {
    useMapStore.setState({ followMode: 'off', selectedTrailId: null, hasZoomedToUser: false })
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
})
