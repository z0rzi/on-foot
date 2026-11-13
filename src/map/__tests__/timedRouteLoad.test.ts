jest.mock('../../log', () => ({ ...jest.requireActual('../../log/oneDecimal'), logEvent: jest.fn() }))

import { logEvent } from '../../log'
import { timedRouteLoad } from '../timedRouteLoad'

const P = { lat: 45.9237, lng: 6.8694, ele: 1035 }

afterEach(() => {
  jest.restoreAllMocks()
  jest.mocked(logEvent).mockClear()
})

test('hands back what the load found and logs its duration and point count', async () => {
  jest.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(141.26)
  const entity = { id: 7, geometry: { segments: [[P, P], [P]] } }
  const load = jest.fn(async () => entity)

  await expect(timedRouteLoad('trail', load)(7)).resolves.toBe(entity)

  expect(load).toHaveBeenCalledWith(7)
  expect(jest.mocked(logEvent).mock.calls).toEqual([
    ['info', 'map', 'route loaded', { kind: 'trail', points: 3, ms: 41.3 }],
  ])
})

test('an entity that is gone is handed back as null and logs no timing', async () => {
  await expect(timedRouteLoad('activity', async () => null)(7)).resolves.toBeNull()
  expect(logEvent).not.toHaveBeenCalled()
})

test('a load that fails rejects as it did and logs no timing', async () => {
  const load = async (): Promise<{ geometry: { segments: never[][] } } | null> => {
    throw new Error('disk')
  }
  await expect(timedRouteLoad('activity', load)(7)).rejects.toThrow('disk')
  expect(logEvent).not.toHaveBeenCalled()
})
