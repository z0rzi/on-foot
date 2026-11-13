jest.mock('../client', () => ({ db: { select: jest.fn(), update: jest.fn() } }))

import { db } from '../client'
import { activities } from '../schema'
import { sqliteActivitiesRepository } from '../activitiesRepository'

const select = db.select as jest.Mock
const update = db.update as jest.Mock

// The row read for a fill, and the values the fill writes back.
function fillRead(geometry: string): jest.Mock {
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ geometry }]) }) }) })
  const set = jest.fn(() => ({ where: () => Promise.resolve() }))
  update.mockReturnValue({ set })
  return set
}

const summaryRow = {
  id: 4, name: 'Morning', effort: 'moderate', linkedTrailId: 2, distanceMeters: 5000,
  durationSeconds: 3600, elevationGainMeters: 120, elevationLossMeters: 110, startedAt: 7, createdAt: 8,
  overviewGeometry: '{"type":"MultiLineString","coordinates":[]}', startLat: 45.2, startLng: 6.1,
}

beforeEach(() => {
  select.mockReset()
  update.mockReset()
  select.mockReturnValue({ from: () => ({ orderBy: () => Promise.resolve([summaryRow]) }) })
})

test('the activity overview rows read selects columns, never the geometry', async () => {
  await sqliteActivitiesRepository.listOverviewRows()
  const selection = select.mock.calls[0][0]
  expect(selection).toBeDefined()
  expect(Object.values(selection)).not.toContain(activities.geometry)
})

test('the activity overview rows map from the selected columns', async () => {
  await expect(sqliteActivitiesRepository.listOverviewRows()).resolves.toEqual([{
    id: 4, name: 'Morning', effort: 'moderate', linkedTrailId: 2, startedAt: 7, createdAt: 8,
    metrics: { distanceMeters: 5000, durationSeconds: 3600, elevationGainMeters: 120, elevationLossMeters: 110 },
    overviewGeometry: '{"type":"MultiLineString","coordinates":[]}', start: { lat: 45.2, lng: 6.1 },
  }])
})

test('filling a row stores the overview of its geometry', async () => {
  const set = fillRead('{"segments":[[{"lat":45,"lng":6,"ele":null},{"lat":45,"lng":6.01,"ele":null}]]}')
  await expect(sqliteActivitiesRepository.fillOverview(1)).resolves.toEqual({ kind: 'filled' })
  expect(set).toHaveBeenCalledWith({
    overviewGeometry: '{"type":"MultiLineString","coordinates":[[[6,45],[6.01,45]]]}', startLat: 45, startLng: 6,
  })
})

test('a row whose geometry cannot be read is stored with an empty overview', async () => {
  const set = fillRead('{not json')
  await expect(sqliteActivitiesRepository.fillOverview(1)).resolves.toMatchObject({ kind: 'unreadable' })
  expect(set).toHaveBeenCalledWith({
    overviewGeometry: '{"type":"MultiLineString","coordinates":[]}', startLat: null, startLng: null,
  })
})

test('a row deleted since it was listed is missing, and nothing is written', async () => {
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) })
  await expect(sqliteActivitiesRepository.fillOverview(1)).resolves.toEqual({ kind: 'missing' })
  expect(update).not.toHaveBeenCalled()
})
