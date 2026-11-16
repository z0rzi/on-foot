import { stillLoading } from '../readiness'

const loaded = { launchResolved: true, trails: true, activities: true, offlinePacks: true, resumeSettled: true }

describe('what the app still loads', () => {
  it('is nothing once every launch step has settled', () => {
    expect(stillLoading(loaded)).toEqual([])
  })

  it('names each step still loading, in launch order', () => {
    expect(stillLoading({ launchResolved: false, trails: false, activities: false, offlinePacks: false, resumeSettled: false })).toEqual([
      'launch',
      'trails',
      'activities',
      'offline packs',
      'recording',
    ])
    expect(stillLoading({ ...loaded, offlinePacks: false })).toEqual(['offline packs'])
    expect(stillLoading({ ...loaded, resumeSettled: false })).toEqual(['recording'])
  })
})
