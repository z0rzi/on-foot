import { useScrubStore } from '../scrubStore'

beforeEach(() => useScrubStore.setState({ point: null }))

describe('scrubStore', () => {
  it('starts empty', () => {
    expect(useScrubStore.getState().point).toBeNull()
  })
  it('setPoint sets and clears the scrub point', () => {
    useScrubStore.getState().setPoint({ lat: 1, lng: 2 })
    expect(useScrubStore.getState().point).toEqual({ lat: 1, lng: 2 })
    useScrubStore.getState().setPoint(null)
    expect(useScrubStore.getState().point).toBeNull()
  })
})
