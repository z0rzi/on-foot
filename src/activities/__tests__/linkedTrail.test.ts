jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))

import { logEvent } from '../../log'
import { loadActivityWithLinkedTrail } from '../linkedTrail'
import { Activity } from '../../data/activities/types'
import { Trail } from '../../data/trails/types'

const logged = jest.mocked(logEvent)

const activity = (linkedTrailId: number | null): Activity => ({
  id: 1, name: 'A1', effort: 'easy', comments: null,
  metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  geometry: { segments: [] }, linkedTrailId, startedAt: 1, endedAt: 2, createdAt: 1,
})
const trail: Trail = {
  id: 43, name: 'T43', difficulty: 'easy', description: null,
  metrics: { distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  geometry: { segments: [], waypoints: [] }, createdAt: 1, updatedAt: 1,
}

beforeEach(() => {
  logged.mockClear()
})

test('an activity whose link a trail delete cleared looks no trail up and logs nothing', async () => {
  const getTrail = jest.fn().mockResolvedValue(null)
  const loaded = await loadActivityWithLinkedTrail(1, async () => activity(null), getTrail)
  expect(loaded?.linkedTrail).toBeNull()
  expect(getTrail).not.toHaveBeenCalled()
  expect(logged).not.toHaveBeenCalled()
})

test('a linked activity carries its trail', async () => {
  const loaded = await loadActivityWithLinkedTrail(1, async () => activity(43), async () => trail)
  expect(loaded?.linkedTrail).toBe(trail)
  expect(logged).not.toHaveBeenCalled()
})

test('a link to a trail that is gone carries no trail and is logged', async () => {
  const loaded = await loadActivityWithLinkedTrail(1, async () => activity(43), async () => null)
  expect(loaded?.linkedTrail).toBeNull()
  expect(logged).toHaveBeenCalledWith('warn', 'error', 'linked trail not found', { id: 43 })
})

test('a failed trail read keeps the activity, carries no trail and is logged', async () => {
  const loaded = await loadActivityWithLinkedTrail(1, async () => activity(43), () => Promise.reject(new Error('db')))
  expect(loaded?.id).toBe(1)
  expect(loaded?.linkedTrail).toBeNull()
  expect(logged).toHaveBeenCalledWith('error', 'error', 'linked trail load failed', { id: 43, errorClass: 'Error' })
})

test('a missing activity is missing, with no trail lookup', async () => {
  const getTrail = jest.fn()
  expect(await loadActivityWithLinkedTrail(1, async () => null, getTrail)).toBeNull()
  expect(getTrail).not.toHaveBeenCalled()
})
